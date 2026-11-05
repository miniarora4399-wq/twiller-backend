export function isMobileLoginAllowed(){
    const parts = new Intl.DateTimeFormat("en-GB",{
        timeZone: "Asia/Kolkata",
        hour : "2-digit",
        minute : "2-digit",
        hourCycle : "h23",
    }).formatToParts(new Date());

    const hour = Number(parts.find(p => p.type === "hour").value);

    const minute = Number(parts.find(p => p.type === "minute").value);

    const currentMinutes = hour * 60 + minute;

    return currentMinutes >= 600 && currentMinutes < 780;
}