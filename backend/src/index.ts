import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3000;

function main() {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

if (require.main === module) {
    main();
}