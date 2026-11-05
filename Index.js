import express from "express";
import path from "path";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./modals/user.js";
import Tweet from "./modals/tweet.js";
import multer from "multer";
import nodemailer from "nodemailer";
import ffmpeg from "fluent-ffmpeg";
import { resolve } from "nodemailer/lib/shared/url.js";
import "dotenv/config";
import Razorpay from "razorpay";
import crypto from "crypto";
import twilio  from "twilio";
import { error, info } from "console";
import { UAParser } from "ua-parser-js";
import loginhistory from "./modals/loginhistory.js";
import { getLoginDetails } from "./utils/loginDetails.js";
import { isMobileLoginAllowed } from "./utils/loginTime.js";
import user from "./modals/user.js";

const loginOTPs = new Map();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const plans = {
  Free: {price: 0, limit :1},
  Bronze: {price: 100, limit :3},
  Silver: {price: 300, limit :5},
  Gold: {price: 1000, limit :Infinity},
};



const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024,
  },  
})

const checkAudioDuration = (filePath) =>{
  return new Promise ((resolve,reject) =>{
    ffmpeg.ffprobe(filePath,(err,metadata) =>{
      if(err){
        reject(err);
      }
      else{
        resolve(metadata.format.duration);
      }
    });
  });
};

dotenv.config();

console.log("EMAIL_USER loaded:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASSWORD loaded:", !!process.env.EMAIL_PASSWORD);
console.log("BACKEND STARTED");

const app = express();
app.use(cors({
  origin:[
    "http://localhost:3000",
    "https://twiller-frontend-seven.vercel.app"
],

  credentials:true,
}));
app.use(express.json());

app.use((req, res, next) => {
  if(req.url.includes("language/send-otp")){
  console.log("REQUEST REACHED BACKEND:", `${req.method} ${req.url}`);
  }
  next();
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


const transporter = nodemailer.createTransport({
 host: "smtp.gmail.com",
 port: 465,
 secure : true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  connectionTimeout:20000,
  greetingTimeout  :20000,
  socketTimeout    :20000,
});
console.log("EMAIL SENT SUCCESSFULLY");

transporter.verify((error, success) => {
  if (error) {
    console.error("Email connection failed:", error.message);
  } else {
    console.log("Email server ready!");
  }
});



const languageOTPs = new Map();

const supportedLanguages = [
  "en",
  "es",
  "hi",
  "pt",
  "zh",
  "fr",
];


function generateOTP(){
  return crypto.randomInt(100000,1000000).toString();
}

//Generate Password
function generateRandomPassword(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

//Payment time:10 AM to 11 AM IST
function isPaymentTime() {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const hours = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? 0);


  console.log("INDIA TIME:",`${hours} : ${minutes}`);

  const currentMinutes = hours * 60 + minutes;
  return currentMinutes >= 10 * 60 && currentMinutes < 11 * 60;

}


// Login History Saving Function

async function saveLoginHistory(req, userId){
  const details = getLoginDetails(req);

  console.log("FINAL LOGIN DETAILS:", details);

  if(details.device === "Mobile" && !isMobileLoginAllowed())
  {
    return res.status(403).json({
      error: "Mobile login is allowed only between 10:00 PM and 1:00 PM IST ."
    });
  }
   
  const history = await loginhistory.create({
    user : userId,
    browser : details.browser,
    operatingSystem: details.operatingSystem,
    device : details.device || "Unknown",
    ipAddress : details.ipAddress || "Unknown",
    loginAt : new Date(),
  });

  return history;
}



app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

console.log("Index file is running");

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

//Register

app.post("/register", async (req, res) => {
  console.log("REGISTER API HIT")
   try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    console.log("Register body:", req.body);
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
 
//loggedinuser
app.get("/loggedinuser", async (req, res) => {
  
  try {
    const { email } = req.query;
    
    console.log("EMAIL RECEIVED:",email);

    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email: email });

    console.log("USER FOUND:", user);
    if (!user) {
      return res.status(404).json({ error: "User not found",email });
      
    }
    return res.status(200).send(user);
      
  } catch (error) {
    return res.status(400).send({error: error.message });
  }
});

 // update Profile
app.patch("/userupdate/:email", async (req, res) => {
   try {
    const { email } = req.params;
     const updated = await User.findOneAndUpdate(
       { email },
       { $set: req.body },
       { new: true, upsert: false }
     );
     return res.status(200).send(updated);
   } catch (error) {
     return res.status(400).send({ error: error.message });
   }
});
// Tweet API

// POST
app.post("/post", async (req, res) => {
  try {
    console.log("POST ROUTE CALLED");
    console.log("POST BODY:", req.body);
    console.log("AUDIO RECEIVED BY BACKEND:", req.body.audio);

    const { author,content,like,retweets,audio } = req.body;

    if (!author){
      return res.status(400).send({ error: "Author is required" });
    }

    if(!content?.trim() && !audio){
      return res.status(400).send({
        error: "Please enter content or upload audio"
      });
    }

    const authenticateUser = await User.findById(author);

    if(!authenticateUser){
      return res.status(404).send({error: "User not found",});
    }
    const tweet = new Tweet({
      author: authenticateUser._id,
      content: content || "",
      like: 0,
      retweets: 0,
      audio: audio || "",
    });

    await tweet.save();

    authenticateUser.tweetsThisMonth = (authenticateUser.tweetsThisMonth || 0) + 1;
    
    await authenticateUser.save();
    
    console.log("POST SAVED MONGODB:", tweet);
    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
//  LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// retweet 
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// OTP for Audio Tweet
 let audioOTP ={};

 app.post("/audio/send-otp", async (req,res) =>{
  try{
    // IST time check


    const currentTime = new Date();

    const istTime = new Intl.DateTimeFormat("en-IN",{
      timeZone:"Asia/Kolkata",
      hour:"2-digit",
      minute:"2-digit",
      hour12:false,
    }).formatToParts(currentTime);
    
    const currentHour = Number(
      istTime.find((p) => p.type === "hour")?.value
    );

    const currentMinute = Number(
      istTime.find((p) => p.type === "minute")?.value
    );

    const totalMinutes = currentHour * 60 + currentMinute;

    if(totalMinutes < 840 || totalMinutes >= 1140){
      return res.status(400).json({
        message:"Audio tweets are allowed only between 2:00 PM and 7:00 PM IST.",
      });
    }
    
    //Generate 6 digit OTP
    
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // TODO
    // Replace this with the logged-in user's registered email
    console.log("AUDIO SEND OTP ROUTE HIT");
    console.log("BODY:", req.body);
    const userEmail = req.body.userEmail;

    if(!userEmail){
      return res.status(400).json({
        message: "Registered email is required.",
      });
    }

    audioOTP[userEmail] = {
      otp: generatedOTP,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASSWORD:", process.env.EMAIL_PASSWORD);

    const mailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    console.log("Mail Sent successfully");

    console.log("Sending OTP to:", userEmail);
    console.log("Generated OTP:", generatedOTP);    
    

    await mailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "Twiller Audio Tweet OTP",
      text: `Your OTP for Audio Tweet is ${generatedOTP}. This OTP expires in 5 minutes.`,
    });

    res.json({
      message: "OTP sent successfully.",
    });
  } catch (error) {
    console.error("OTP error full:", error);

    if (error.response) {
      console.error(error.response);
    }

    res.status(500).json({
      message: "Failed to send OTP.",
    });
  }
});
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASSWORD:", process.env.EMAIL_PASSWORD);

// OTP Verification

app.post("/audio/verify-otp", async (req, res) =>{
  try{

    console.log("VERIFY BODY:", req.body);
    console.log("OTP STORE:", audioOTP);
    const {userEmail,generatedOTP} = req.body;
 
    const verifyOTP =audioOTP[userEmail];

    if(!verifyOTP){ 
      return res.status(400).json({
        message:"OTP not found.",
      });
    }

    if(Date.now() > verifyOTP.expiresAt){
      delete audioOTP[userEmail];

      return res.status(400).json({
        message: "OTP expired.",
      });
    }
     if(verifyOTP.otp !== generatedOTP){
      return res.status(400).json({
        message: "Invalid OTP."});
     }

     delete audioOTP[userEmail];

     res.json({
      message:" OTP verified successfully.",});
  
  }catch(error){
    console.error("OTP verification error:",error);

    res.status(500).json({
      message: "OTP verification failed.",});
  }

});

// Audio tweet upload

app.post("/audio-tweet", upload.single("audio"),async (req,res) =>{
  try{
    // Check IST time again in on backend

    const currentTime = new Date();

    const istTime = new Intl.DateTimeFormat("en-IN",{
      timeZone:"Asia/Kolkata",
      hour:"2-digit",
      minute:"2-digit",
      hour12:false,
    }).formatToParts(currentTime);
    
    const currentHour = Number(
      istTime.find((p) => p.type === "hour")?.value
    );

    const currentMinute = Number(
      istTime.find((p) => p.type === "minute")?.value
    );

    const totalMinutes = currentHour * 60 + currentMinute;

    if(totalMinutes < 840 || totalMinutes >= 1140){
      return res.status(400).json({
        message:"Audio tweets are allowed only between 2:00 PM and 7:00 PM IST.",
      });
    }

    if(!req.file){
      return res.status(400).json({
        message:"Audio file is required.",
      });
    }

    const audioDuration = await checkAudioDuration(req.file.path);

    if(audioDuration > 300){
      return res.status(400).json({
        message : "Audio duration must not exceed 5 minutes.",
      });
    }


    // 100 MB check
    if(req.file.size > 100 * 1024 * 1024){
      return res.status(400).json({
        message: "Audio file cannot exceed 100 MB.",
      });
    }

    // Audio duration must also be checked
    // Frontend checks it before upload
    // For strict backend validation use ffprobe/ffmpeg

    console.log("Audio received:", req.file);

    res.status(201).json({
      message:"Audio tweet uploaded successfully.",
      file: req.file.filename,
      audio: `/uploads/${req.file.filename}`
    });
  }catch(error){
    console.error("Audio upload error:", error);

    res.status(500).json({
      message:"Audio upload failed.",
    });
  }
    
});

//Forgot Password
app.post("/forgot-password", async (req, res) => {
  try { 
    const { email,phone } = req.body;

    if(!email && !phone){
      return res.status(400).json({
        message :"Please enter your email or phone number",
      });
    }
   
    const user = email ? await User.findOne({email: email.trim().toLowerCase()}):await User.findOne({phone: phone.trim()});
    
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    const now = new Date();

    console.log("Last reset date:", user.lastPasswordResetDate);
    console.log("Current date:", new Date());
    console.log("User email:", user.email);

    
    if (user.lastPasswordResetDate)
       {
         const lastReset = new Date(user.lastPasswordResetDate);
         const now  = new Date();

         if(lastReset.getFullYear() === now.getFullYear() &&
            lastReset.getMonth() === now.getMonth() &&
            lastReset.getDate() === now.getDate())
            {
              return res.status(429).send
              ({ error: "You can use this option only one time per day." });
               }   
        }

    const newPassword = generateRandomPassword();
    user.password = newPassword;
    user.lastPasswordResetDate = now;
    await user.save();
    
    if(user.email){
      try{
        await transporter.sendMail({
          from : process.env.EMAIL_USER,
          to   :user.email,
          subject: "Twiller Password Reset",
          text : `Your new Twiller password is ${newPassword}`,
        });

        return res.status(200).json({
          message : "New password sent to your registered email.",
        });
      } catch (emailError) {
        console.error("Password reset email error:", emailError);
        return res.status(500).json({
          message : "Password was changed, but email delivery failed. Contact support.",
        });
      }
    }

    return res.status(400).json({
      message : "No registered email found.SMS delivery must be configured for phone password reset"
    });
  }
  catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Password reset failed.",
    });
  }
});


// Razorpay Payment Integration
app.post("/subscription/create-order", async (req, res) => {
  try {

     console.log("SUBSCRIPTION BODY:", req.body);
     console.log("CREATE ORDER BODY:", req.body);
     console.log("RAZORPAY KEY:", process.env.RAZORPAY_KEY_ID ? "Present" : "Missing");

    if (!isPaymentTime()) {
      return res.status(400).send({ error: "Payments can only be made between 10 AM and 11 AM IST" });
    }

    const {plan } = req.body;

    if (!plan || !["Free", "Bronze", "Silver", "Gold"].includes(plan)) {
      return res.status(400).send({ error: "Invalid subscription plan" });
    }

    console.log("PLAN RECEIVED:", plan);
    console.log("AVAILABLE PLANS:", plans);
    console.log("MATCHED PRICE:", plans[plan]);

    const order = await razorpay.orders.create({
      amount: plans[plan].price * 100, // Amount in paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
      notes: { plan },
    });

    return res.status(200).send({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("FULL RAZORPAY ERROR", error);
    return res.status(500).send({ error: error.message });
  }
});

// Razorpay Payment Verification
app.post("/subscription/verify-payment", async (req, res) => {
  console.log("VERIFY PAYMENT ROUTE HIT");
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature } = req.body; 
 
      // Verify the payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

      if(!razorpay_signature ||
        Buffer.byteLength(generatedSignature) !== Buffer.byteLength(razorpay_signature) ||
        !crypto.timingSafeEqual(
          Buffer.from(generatedSignature),
          Buffer.from(razorpay_signature)))
        {
         return res.status(400).send({ error: "Invalid payment signature" });
        }

        // Verify the order and payment status with Razorpay API
        const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

        if(orderDetails.status !== "paid" ||
           paymentDetails.status !== "captured" || 
            paymentDetails.order_id !== orderDetails.id){
          return res.status(400).send({ error: "Payment not successful" });
        }

        const plan = orderDetails.notes.plan;

        if(!["Free", "Bronze", "Silver", "Gold"].includes(plan) ||
        paymentDetails.amount !== plans[plan].price * 100 ||
        paymentDetails.currency !== "INR"){
          return res.status(400).send({ error: "Payment details mismatch" });
        }

        console.log("PAYMENT VERIFIED SUCCESSFULLY");
        console.log("BEFORE EMAIL SENDING");
        


        //IMPORTANT:
        // req.user should be set by authentication middleware
        // Never trust a user Id sent directly from the browser

        console.log("REQ.USER:", req.user);
        console.log("REQ.USER ID:", req.user?._id);

        if(!req.user?._id)
        {
          return res.status(401).send({ message: "Please log in before purchasing a plan" });
        }


        const user = await User.findById(req.user._id);

        console.log("USER ID:", req.user._id);
        console.log("USER FOUND:", !!user);
        console.log("USER EMAIL:", user?.email);


        if(!user){
          return res.status(404).send({ error: "User not found" });
        }

        console.log("BEFORE EMAIL SENDING");
        console.log("USER EMAIL:", user?.email);

        //Prevent the same payment from being processed multiple times
        //Store processed payment IDs in a seperate payment collection
        //with a unique index for production use.

        const now = new Date();
        const currentExpiryDate = user.SubscriptionExpireDate &&
        new Date(user.SubscriptionExpireDate) > now
        ? new Date(user.SubscriptionExpireDate)
        : now;    

        const expiryDate = new Date(currentExpiryDate);
        expiryDate.setMonth(expiryDate.getMonth() + 1); 

        user.SubscriptionPlan = plan;
        user.SubscriptionExpireDate = expiryDate;
        await user.save();

        console.log("SUBSCRIPTION UPDATED");

        //Email subscription confirmation & invoice details
        
        console.log("EMAIL ROUTE STARTED");
        console.log("REGISTERED EMAIL:", user?.email);
      try{
        const info = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `${plan} Subscription Invoice - Twiller`,
          text: `Hello,
            Your Twiller subscription payment was successful.
            Plan: ${plan}
            Amount: ₹${plans[plan].price}
            Monthly tweet limit: ${plans[plan].limit === Infinity ? "Unlimited" : plans[plan].limit}
            Payment ID: ${razorpay_payment_id}
            Order ID: ${razorpay_order_id}
            Valid until: ${expiryDate.toISOString()}

            Please keep this email as your payment receipt.`,
          
        });
          console.log("AFTER EMAIL SENDING");
          console.log("INVOICE EMAIL SENT:", info.messageId);

    
      }
      catch(emailError){
        console.error("EMAIL ERROR:", emailError);
      }

        return res.status(200).send({
           success: true,
           message: `${plan} plan activated successfully.`
           ,
           plan: plan,
           tweetLimit: plans[plan].limit === Infinity ? "Unlimited" : plans[plan].limit,
           expiresAt: expiryDate.toISOString(),
          });

  }catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).send({ error: "Payment verification failed" });
  }
 
 
 });

// User should come from authentication middleware

app.post("/post", async (req, res) => {
  try {
    const authenticateUser = await User.findById(req.user._id);

    if (!authenticateUser) {
      return res.status(401).send({ error: "User not found" });
    }

    // Check subscription expiry
    if (
      authenticateUser.SubscriptionPlan !== "Free" &&
      authenticateUser.SubscriptionExpireDate &&
      new Date(authenticateUser.SubscriptionExpireDate) <= new Date()
    ) {
      authenticateUser.SubscriptionPlan = "Free";
      authenticateUser.SubscriptionExpireDate = null;
      authenticateUser.tweetsThisMonth = 0;
    }

    // Get the selected plan's tweet limit
    const plan = plans[authenticateUser.SubscriptionPlan] || plans.Free;

    // Block when the limit is reached
    if (authenticateUser.tweetsThisMonth >= plan.limit) {
      await authenticateUser.save();

      return res.status(403).json({
        message: `Your ${authenticateUser.SubscriptionPlan} plan tweet limit is reached. Please upgrade your plan.`,
      });
    }

    // Existing tweet creation and save logic goes here.
    // keep your current code that creates and saves a tweet.

    return res.status(201).json({
      message: "Tweet created successfully",
      user: authenticateUser._id,
    });
  } catch (error) {
    console.error("Post error:", error);
    return res.status(500).json({
      error: "Failed to create tweet",
    });
  }
});

// Multi Language Support
app.post("/language/send-otp", async (req, res) => {

  console.log("🔥 LANGUAGE OTP ROUTE HIT");
  try{

    console.log("SEND OTP ROUTE CALLED");
    console.log("Request body:", req.body);
    console.log("Request query:", req.query);
    
    const {email,language} = req.body;

    console.log("Received email:", email);
    console.log("Received language:",language);

    if(!email || typeof email !== "string"){
      return res.status(401).json({
        message: "Valid email is required",
      });
    }

    if(!supportedLanguages.includes(language)){
      return res.status(400).json({
        message : "Unsupported language",
      });
    }

    console.log("SEARCHING EMAIL:", email);
   
    const user = await User.findOne({ email: email.trim() });
    console.log("USER FOUND:", user);
    console.log("User details:", user);
    console.log("Mobile number:", user?.phone);

    if(!user){
      return res.status(401).json({
        message : "User not found.",
      });
    }

    if(!user.email){
      return res.status(400).json({
        message: "Registered email not found",
      });
    }
    
    const destination = user.email;

    const otp = generateOTP();

    const key = String(user._id ?? user.id);

    languageOTPs.set(key,{
      otp,
      language,
      method:"email",
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts :0,
    }); 

    console.log("BEFORE SENDING EMAIL");

      await transporter.sendMail({
        from : process.env.EMAIL_USER,
        to: destination,
        subject: "Twiller Language Verification OTP",
        text : `Your OTP is ${otp}. It expires in 5 minutes.`,
      });
     
      console.log("EMAIL SENT:", info.messageId);
      console.log("Language OTP sent to registered email");

      return res.status(200).json({
        success : true,
        message : "OTP sent to your registered email.",
      });

}catch(error)
{
  console.error("Language OTP error:",error)
  
  if(error && typeof error === "object"){
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.moreInfo);
    console.error("HTTP status:", error.status);
  }

  return res.status(500).json({
    message: error instanceof Error ? error.message : "Unable to send OTP",
    code: error?.code || null,
  });

}
});

app.post("/language/verify-otp", async (req,res) => {
  try{
    const {email,language,otp} = req.body;

    if(!email || !language || !otp){
      return res.status(400).json({
        message : "Email,language and OTP are required",
      });
    }

    const user = await User.findOne({
      email: email.trim(),
    });

    if(!user){
      return res.status(404).json({
        message : "User not found",
      });
    }
    
    const key = String(user._id);
    const saved = languageOTPs.get(key);

    if(!saved || saved.language !== language){
      return res.status(400).json({
        message : "Please request a new OTP",
      });
    }
    if(Date.now() > saved.expiresAt){
      languageOTPs.delete(key);

      return res.status(400).json({
        message: "OTP expired. Request a new OTP.",
      });
    }
    saved.attempts += 1;

    if(saved.attempts > 5){
      languageOTPs.delete(key);
      return res.status(429).json({
        message : "Too many attempts. Request a new OTP.",
      });
    }

    if (String(otp).trim() !== String(saved.otp).trim()){
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    languageOTPs.delete(key);
    return res.json({
      message: "Language verified successfully",
      language,
    });
  } catch(error) {
    console.error("Language OTP verification error:", error);
    return res.status(500).json({
      message: "Unable to verify OTP",
    });
  }
});

// Login History API

app.get("/login-history/:userId", async(req,res) =>{
  try{
    const {userId} = req.params;

    const history = await loginhistory.find({user: userId})
    .sort({loginAt : -1})
    .limit(50)
    .lean();

    return res.status(200).json(history);
  }catch(error){
    console.error("LOGIN HISTORY ERROR:", error);
    return res.status(500).json({
      error : "Unable to load login history",
    });
  }
})

//OTP for login history

app.post("/send-login-history-otp", async (req,res) =>{

  
  try{
    const {email} = req.body;

    if(!email){
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const otp = crypto.randomInt(100000,1000000).toString();

    loginOTPs.set(email,{
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Twiller Google Login History OTP",
      text: `Your OTP for accessing login history is ${otp}. It expires in 5 minutes.`,
    });

    return res.status(200).json({
      success: true,
      otpRequired: true,
      message: "OTP sent to your registered email.",
    });
  }catch(error){
    console.error("SEND LOGIN HISTORY OTP ERROR:", error);
    console.error("ERROR CODE:", error.code);
    console.error("ERROR RESPONSE:", error.response);
    return res.status(500).json({ 
      success: false,
      error: error.message ||"Unable to send OTP",
    });
  }
});

// OTP verification for login history

app.post("/verify-login-history-otp", async (req,res) =>{
  try{
    const {email, otp} = req.body;

    if(!email || !otp){
      return res.status(400).json({
        error: "Email and OTP are required",
      });
    }

    const key = email.trim().toLowerCase();
       loginOTPs.set(key, {
       otp: String(otp),
       expiresAt: Date.now() + 5 * 60 * 1000,
      });
    
    const saved = loginOTPs.get(key);

    console.log("VERIFY EMAIL:", key);
    console.log("SAVED OTP DATA:", saved);

    if(!saved){
      return res.status(400).json({
        error: "Invalid or expired OTP",
      });
    }

    if(Date.now() > saved.expiresAt){
      loginOTPs.delete(key);
      return res.status(400).json({
        error: "OTP expired. Request a new OTP.",
      });
    }

    console.log("ENTERED OTP:", String(otp).trim());
    console.log("STORED OTP:", String(saved.otp).trim());

    if(String(otp).trim() !== String(saved.otp).trim()){
      return res.status(400).json({
        error: "Invalid OTP",
      });
    }

    loginOTPs.delete(key);
    return res.json({
      success: true,
      message: "OTP verified successfully",
    });
  }catch(error){
    console.error("VERIFY LOGIN HISTORY OTP ERROR:", error);
    console.error("VERIFY OTP ACTUAL ERROR:", error);
    console.error("ERROR MESSAGE:", error.message);
    console.error("ERROR STACK:", error.stack);

    return res.status(500).json({
      error: "Unable to verify OTP",
    });
  }
});

// Save login history API

app.post("/save-login-history",async (req,res) =>{
  try{

    console.log("SAVE LOGIN HISTORY BODY:",req.body);
    
    const {userId} = req.body;
    
    if(!userId){
      return res.status(400).json({error: "User Id required"});
    }

    console.log("LOGIN HISTORY REQUEST:",req.body);

    const history = await saveLoginHistory(req,userId);

    console.log("SAVED TO MONGODB:",history);

    return res.status(201).json({
      message: "Login history saved",
      history,
    });
  }catch(error){
    console.error("SAVE LOGIN HISTORY ERROR:", error);
    return res.status(500).json({
      error: "Unable to save login history",
    });
  }

})

