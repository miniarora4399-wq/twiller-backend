import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: {type: String, required:false},
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
  audio:{type: String, default :"",},
  lastPasswordResetDate: { type: Date, default: null },
  SubscriptionPlan: { type: String, enum: ["Free", "Bronze", "Silver", "Gold"], default: "Free" },
  tweetsThisMonth: { type: Number, default: 0 },
  SubscriptionExpireDate: { type: Date, default: null },
  loginHistory : [
    {
      browser :{type: String,default:"Unknown"},
      os : {type: String, default:"Unknown"},
      device : {type: String, default:"Unknown"},
      ipAddress : {type : String, default:"Unknown"},
      loginAt : {type: Date, default: Date.now},
    }]
});

export default mongoose.model("User", UserSchema); 