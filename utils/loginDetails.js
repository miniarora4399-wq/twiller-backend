export function getLoginDetails(req){
    
    console.log("USER AGENT:", req.headers["user-agent"]);

    const ua = req.headers["user-agent"] ||
               req.headers["User-Agent"] || "";
    
    console.log("USER AGENT:",ua);

    let browser = "Unknown";
    let operatingSystem = "Unknown";

    if(/Edg\//i.test(ua))          browser = "Microsoft Edge";
    
    else if(/chrome\//i.test(ua))  browser = "Google Chrome";
    
    else if(/Firefox\//i.test(ua)) browser = "Mozila Firefox";

    else if(/safari\//i.test(ua))   browser = "Safari";
    
    if(/windows/i.test(ua))      operatingSystem = "Windows";
    
    else if(/Android/i.test(ua)) operatingSystem = "Android";
    
    else if(/iPhone|ipad|ipod/i.test(ua)) operatingSystem = "iOS";
    
    else if(/Mac OS X|Macintosh/i.test(ua)) operatingSystem = "macOS";
    
    else if(/Linux/i.test(ua)) operatingSystem = "Linux";
    

    let device = "Desktop";

    if(/Mobile|Android|iPhone|iPod/i.test(ua)){
        device = "Mobile";
    }
    else if(/ipad|Tablet/i.test(ua)){
        device = "Mobile";
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = (typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0].trim() : null) ||
        req.socket?.remoteAddress || "Unknown";

    console.log("DETECTED DETAILS:",{
        browser,
        operatingSystem,
        device,
        ipAddress,
    });

    return {browser, operatingSystem, device,ipAddress};

}