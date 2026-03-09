import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBo-bC-00qqa1wvd2F3zPMglmcISHDvOoU",
  authDomain: "finance-tracker-afca3.firebaseapp.com",
  projectId: "finance-tracker-afca3",
  storageBucket: "finance-tracker-afca3.firebasestorage.app",
  messagingSenderId: "991185415262",
  appId: "1:991185415262:web:947ff135f6be3a1b3c58cf",
};

const hasInitializedApp = getApps().length > 0;
export const app = hasInitializedApp ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
