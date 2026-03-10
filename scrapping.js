require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

class TrainScraper {
    constructor() {
        this.baseUrl = 'https://cttrains.co.za/train-schedule.php';
    }

    buildUrl(fromStation, toStation, travelDate, departureTime) {
        const encodedFromStation = encodeURIComponent(fromStation);
        const encodedToStation = encodeURIComponent(toStation);
        const encodedTravelDate = encodeURIComponent(travelDate);
        const encodedDepartureTime = encodeURIComponent(departureTime);

        return `${this.baseUrl}?fromStation=${encodedFromStation}&toStation=${encodedToStation}&travelDate=${encodedTravelDate}&departureTime=${encodedDepartureTime}`;
    }

    extractTrainNumber(text) {
        const match = text.match(/Train number:\s*(\S+)/i);
        return match ? match[1] : text.replace('Train number:', '').trim();
    }

    extractStopCount(text) {
        const match = text.match(/(\d+)/);
        return match ? Number(match[1]) : 0;
    }

    formatStop(stop) {
        return `${stop.time} - ${stop.station} - ${stop.type}`;
    }


    extractData($, card) {
        const data = [];
        let currentData = null;

        $(card).find('.flex.items-center').each((index, element) => {
            const line = $(element).find('.font-semibold.text-lg').first().text().trim();
            const trainInfo = $(element).find('.font-normal.text-base').first().text().trim();

            if (line) {
                if (currentData) {
                    data.push(currentData);
                }

                currentData = {
                    line,
                    trainNumber: this.extractTrainNumber(trainInfo),
                    departure: '',
                    arrival: ''
                };
            }
        });

        if (currentData) {
            data.push(currentData);
        }

        const stationRows = $(card).find('.space-y-3 > .flex.items-center');
        const allStops = [];

        stationRows.each((index, row) => {
            const time = $(row).find('.station-time').first().text().trim();
            const stationName = $(row).find('.station-name .font-medium').first().text().trim();
            const stationType = $(row).find('.station-name .text-gray-600').first().text().trim();

            if (time && stationName) {
                allStops.push({
                    time,
                    station: stationName,
                    type: stationType.replace(/^-\s*/, '').trim()
                });
            }
        });

        // For single data journey
        if (data.length === 1 && allStops.length >= 2) {
            data[0].departure = this.formatStop(allStops[0]);
            data[0].arrival = this.formatStop(allStops[allStops.length - 1]);
        }

        // For multi-data journey with transfers
        if (data.length > 1) {
            if (allStops[0]) {
                data[0].departure = this.formatStop(allStops[0]);
            }

            let currentStopIndex = 0;

            for (let i = 0; i < data.length; i++) {
                // Find the arrival for current data
                for (let j = currentStopIndex; j < allStops.length; j++) {
                    if (allStops[j].type === 'Arrival') {
                        data[i].arrival = this.formatStop(allStops[j]);
                        currentStopIndex = j + 1;
                        break;
                    }
                }

                // Find the departure for next data (if exists)
                if (i < data.length - 1) {
                    for (let j = currentStopIndex; j < allStops.length; j++) {
                        if (allStops[j].type === 'Departure') {
                            data[i + 1].departure = this.formatStop(allStops[j]);
                            currentStopIndex = j + 1;
                            break;
                        }
                    }
                }
            }
        }

        return data;
    }

    formatScheduleData(schedule, index) {
        const parts = [
            `\n------- option ${index} ------\n`,
            schedule.line,
            `Train number: ${schedule.trainNumber}`,
            schedule.departure,
            schedule.arrival,
            `Stops: ${schedule.stops}`
        ];

        if (schedule.transfers && schedule.transfers.length > 0) {
            schedule.transfers.forEach(transfer => {
                parts.push(''); // Empty line separator
                parts.push(transfer.line);
                parts.push(`Train number: ${transfer.trainNumber}`);
                parts.push(transfer.departure);
                parts.push(transfer.arrival);
            });
        }

        return parts.join('\n');
    }

    parseScheduleCard($, card) {
        const optionText = $(card).find('h2').first().text().trim();
        const transferText = $(card).find('p, span, div').filter((index, el) => {
            return $(el).text().includes('Number of Transfers:');
        }).first().text().trim();

        const stopsText = $(card).find('.toggle-stops span').first().text().trim();
        const data = this.extractData($, card);

        if (data.length === 0) {
            return null;
        }

        const mainData = data[0];
        const transfers = data.slice(1);

        return {
            option: optionText,
            line: mainData.line,
            trainNumber: mainData.trainNumber,
            departure: mainData.departure,
            arrival: mainData.arrival,
            stops: this.extractStopCount(stopsText),
            transferCount: this.extractStopCount(transferText),
            transfers
        };
    }

    async getTrainSchedule(fromStation, toStation, travelDate, departureTime) {
        try {
            const url = this.buildUrl(fromStation, toStation, travelDate, departureTime);

            console.log('Fetching train schedule...');
            console.log(url);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const schedules = [];

            $('div.bg-white.rounded-lg.shadow-lg').each((index, card) => {
                const parsedCard = this.parseScheduleCard($, card);

                if (parsedCard) {
                    schedules.push(parsedCard);
                }
            });

            return schedules;

        } catch (error) {
            console.error('Error fetching schedule:', error.message);
            return [];
        }
    }
}

module.exports = new TrainScraper();