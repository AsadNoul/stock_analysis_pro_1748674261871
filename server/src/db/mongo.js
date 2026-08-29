import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectMongo() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongodbUri);
  console.log(`[mongo] connected -> ${config.mongodbUri}`);
  return mongoose.connection;
}
