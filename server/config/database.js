import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // MongoDB connection string - using local MongoDB instance
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vybchat';
        
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            keepAlive: true,
            keepAliveInitialDelay: 300000, // 5 minutes
            socketTimeoutMS: 0, // No timeout
            connectTimeoutMS: 30000 // 30 seconds
        });

        //console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
          // Handle connection events
        mongoose.connection.on('error', (err) => {
            //
        });

        mongoose.connection.on('disconnected', () => {
            //
            // Try to reconnect automatically
            mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                keepAlive: true,
                keepAliveInitialDelay: 300000,
                socketTimeoutMS: 0,
                connectTimeoutMS: 30000            }).catch(err => {
                //
            });
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                //console.log('📴 MongoDB connection closed through app termination');
                process.exit(0);            } catch (error) {
                //
                process.exit(1);
            }
        });

        return conn;
    } catch (error) {        //
        
        // In development, continue without database
        if (process.env.NODE_ENV !== 'production') {
            //
            return null;
        }
        
        // In production, exit the process
        process.exit(1);
    }
};

export default connectDB;
