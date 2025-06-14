// Fix MongoDB duplicate key error by dropping the avatarId index
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/database.js';

// Load environment variables
dotenv.config();

async function fixAvatarIdIndex() {
  console.log('🛠️ Starting MongoDB index fix script...');
  
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to MongoDB');
    
    // Get the User collection
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    // Check if the problematic index exists
    const indexes = await collection.indexes();
    const avatarIdIndex = indexes.find(index => 
      index.name === 'avatarId_1' || 
      (index.key && index.key.avatarId === 1)
    );
    
    if (avatarIdIndex) {
      console.log('🔍 Found problematic avatarId index:', avatarIdIndex.name);
      
      // Drop the index
      await collection.dropIndex(avatarIdIndex.name);
      console.log('✅ Successfully dropped the avatarId index');
      
      // Create a new non-unique index if needed
      await collection.createIndex({ avatarId: 1 }, { 
        name: 'avatarId_1',
        unique: false,
        sparse: false,
        background: true
      });
      console.log('✅ Created new non-unique index for avatarId');
    } else {
      console.log('ℹ️ No problematic avatarId index found');
    }
    
    console.log('🎉 Index fix completed successfully');
  } catch (error) {
    console.error('❌ Error fixing index:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the fix
fixAvatarIdIndex();