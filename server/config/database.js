import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // MongoDB connection string - using local MongoDB instance
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vybchat';
        
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        //console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                //console.log('📴 MongoDB connection closed through app termination');
                process.exit(0);
            } catch (error) {
                console.error('Error closing MongoDB connection:', error);
                process.exit(1);
            }
        });

        return conn;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error.message);
        
        // In development, continue without database
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️ Continuing without database connection in development mode');
            return null;
        }
        
        // In production, exit the process
        process.exit(1);
    }
};

export default connectDB;
