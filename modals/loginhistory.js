import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
    {
       user: {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true,
        index : true,
       },

       browser : {type : String, required: true},
       operatingSystem : {type : String, default : "Unknown"},
       device : {
        type : String,
        enum : ["Desktop", "Laptop", "Mobile", "Unknown"],
        default : "Unknown",
       },

       ipAddress : {type: String, default:"Unknown"},
       loginAt : {type : Date, default : Date.now},
    },

    {timestamps: true}
);

export default mongoose.model("LoginHistory", loginHistorySchema);

