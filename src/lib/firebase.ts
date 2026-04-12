import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCnAituTyyU2JtWPnL1L1mYBzX45xKV1uI",
  authDomain: "studio-1664944821-7e3d5.firebaseapp.com",
  databaseURL: "https://studio-1664944821-7e3d5-default-rtdb.firebaseio.com",
  projectId: "studio-1664944821-7e3d5",
  storageBucket: "studio-1664944821-7e3d5.firebasestorage.app",
  messagingSenderId: "1002608889303",
  appId: "1:1002608889303:web:51a341e375c883cb648f92"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

export { app, db };