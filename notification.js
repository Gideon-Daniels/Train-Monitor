const axios = require('axios');
require('dotenv').config();
const trainScraper = require('./scrapping')
const cron = require('node-cron');

class NotificationService {
    arrivalStation = process.env.ARRIVAL_STATION
    departureStation = process.env.DEPARTURE_STATION
    departureTime = process.env.DEPARTURE_TIME
    token = process.env.PUSHOVER_TOKEN
    user = process.env.PUSHOVER_USER_KEY

    constructor() {
        if(!this.arrivalStation || !this.departureStation || !this.departureTime || !this.token || !this.user){
            throw new Error('Missing required environment variables');
        }

        console.log('started daily notification')
        this.scheduleDailyNotification();
        this.scheduleTrainArrivalCheck();
    }

    async sendNotification() {
        const schedules = await trainScraper.getTrainSchedule(
            this.departureStation,
            this.arrivalStation,
            this.getTodaysDate(),
            this.departureTime
        );

        const message = schedules.map((schedule, index) => {
            return trainScraper.formatScheduleData(schedule, ++index)
        }).join(`\n`);

        try {
            await axios.post(
                "https://api.pushover.net/1/messages.json",
                new URLSearchParams({
                    token:  this.token,
                    user: this.user,
                    message: message
                }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            );
        } catch (err) {
            console.error(err.response?.data || err.message);
        }
    }

    async askTrainArrival() {
        try {
            const response = await axios.post(
                "https://api.pushover.net/1/messages.json",
                new URLSearchParams({
                    token: this.token,
                    user: this.user,
                    message: "🚆 Has the train arrived?",
                    title: "Train Monitor",
                    priority: 2,
                    retry: 3000,
                    expire:30000
                }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            );
            return response.data
        } catch (e){
            console.log(e)
        }
    }

     async checkResponse(receipt){

        const res = await axios.get(
            `https://api.pushover.net/1/receipts/${receipt}.json`,
            {
                params:{
                    token: this.token
                }
            }
        );

        console.log(res.data);
        return res.data
    }


    async acknowledgeTrainArrival(){
        const arrivalData =  await this.askTrainArrival();
        const responseInterval = setInterval(async () => {
            const response = await this.checkResponse(arrivalData.receipt);

            if (response.acknowledged === 1 || response.expired === 1) {
                clearInterval(responseInterval);
                console.log('Interval cleared:', response.acknowledged === 1 ? 'Acknowledged' : 'Expired');
            }
        }, 5000);
    }

    scheduleDailyNotification() {
        // Schedule at 6:00 AM every day
        cron.schedule('27 7 * * *', async () => {
            console.log('Running scheduled notification at 6 AM');
            await this.sendNotification();
        });

        console.log('Daily notification scheduled for 6:00 AM');
    }

    scheduleTrainArrivalCheck() {
        const [hours, minutes] = process.env.DEPARTURE_TIME.split(':');

        // Schedule at your departure time every day
        cron.schedule(`${minutes} ${hours} * * *`, async () => {
            console.log(`Running train arrival check at ${process.env.DEPARTURE_TIME}`);
            await this.acknowledgeTrainArrival();
        });

        console.log(`Train arrival check scheduled for ${process.env.DEPARTURE_TIME}`);
    }

     getTodaysDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}/${month}/${year}`;
    }
}

module.exports = new NotificationService();
