function createUrl() {
    var primaryPhone = formatPhone(Xrm.Page.getAttribute("mobilephone").getValue());
    var secondaryPhone = formatPhone(Xrm.Page.getAttribute("telephone2").getValue());
    var firstParam = primaryPhone ? `primary=${primaryPhone}` : `#`;
    var secondParam = secondaryPhone ? `secondary=${secondaryPhone}` : `#`;
    var queryString = encodeURIComponent(`${firstParam}&${secondParam}`);
 
    var recordUrl = `https://devops365.captorra.com//WebResources/cap_recordingLogs.html?Data=${queryString}`;
    Xrm.Page.data.entity.attributes.get("new_callrecordings").setValue(recordUrl);
    Xrm.Page.data.entity.save();
}

var formatPhone = function (phone) {
    if (phone) {
        var number = phone.match(/\d/g);
        if (number) {
            number = number.join('');
            var formatedPhone = number;
            if (number.length == 11 && formatedPhone.substring(0, 1) == 1) {
                formatedPhone = formatedPhone.substring(1, 11);
            } else if (number.length == 10) {
                formatedPhone = number;
            } else {
                formatedPhone = '';
            }
        }
    } else {
        var formatedPhone = phone;
    }
    return formatedPhone;
}