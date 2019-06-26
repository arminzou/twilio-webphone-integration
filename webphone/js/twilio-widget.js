/*********************************************************************************
 * GLOBALS
 *
 *********************************************************************************/
var device = '';
var twilioTokenUrl = 'https://rose-oyster-6577.twil.io/capability-token';
var twAttr = twAttr || {
    isInForm: '',
    searchEntity: 'contact',
    searchPageString: '/multientityquickfind/multientityquickfind.aspx?option=0&text=',
    contactInfo: {
        contactList: [],
        entityId: 'contactid',
        primaryNumField: 'mobilephone',
        secondaryNumField: 'telephone2'
    },
    crmVersion: 'v8.2',
    dialerCardHtml: '',
    iframeDocument: '',
    cap_draggableUrl: 'https://devops365.captorra.com//WebResources/cap_draggable.js'
};

var phoneObj = {};
var recordData = {};

var timeOnCall,
    seconds = 0,
    minutes = 0,
    hours = 0,
    time;

/*********************************************************************************
 * Helper functions to get the phone number from contact entity
 *
 *********************************************************************************/
var getMobilePhone = function (isPrimary, callback) {
    var entityName = Xrm.Page.data.entity.getEntityName();
    if (entityName === 'contact') {
        phoneObj.primaryNum = formatPhone(Xrm.Page.getAttribute("mobilephone").getValue());
        phoneObj.secondaryNum = formatPhone(Xrm.Page.getAttribute("telephone2").getValue());

        (isPrimary) ? callback(phoneObj.primaryNum): callback(phoneObj.secondaryNum);
    } else {
        var customer = Xrm.Page.getAttribute("cap_potentialclientid").getValue();
        if (customer != null) {
            if (customer[0].entityType == "contact") {
                var contactId = customer[0].id;
                contactId = contactId.replace("{", "").replace("}", "");
                if (contactId != null) {
                    var req = new XMLHttpRequest();
                    var url = Xrm.Page.context.getClientUrl() + "/api/data/v8.2/contacts(" + contactId + ")?$select=mobilephone,telephone2";
                    req.open("GET", url, true);
                    req.setRequestHeader("Accept", "application/json");
                    req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
                    req.onreadystatechange = function () {
                        if (req.readyState == 4) {
                            var result = JSON.parse(req.responseText);
                            var mobilephone = result.mobilephone;
                            var telephone2 = result.telephone2;
                            phoneObj.primaryNum = formatPhone(mobilephone);
                            phoneObj.secondaryNum = formatPhone(telephone2);
                            (isPrimary) ? callback(phoneObj.primaryNum): callback(phoneObj.secondaryNum);
                        }
                    };
                    req.send(null);
                }
            } else if (customer[0].entityType == "incident") {
                var incidentId = customer[0].id;
                incidentId = incidentId.replace("{", "").replace("}", "");
                if (incidentId != null) {
                    var req = new XMLHttpRequest();
                    var url = Xrm.Page.context.getClientUrl() + "/api/data/v8.2/incidents(" + incidentId +
                        ")?$select=incidentid&$expand=customerid_contact($select=mobilephone,telephone2)";
                    req.open("GET", url, true);
                    req.setRequestHeader("Accept", "application/json");
                    req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
                    req.onreadystatechange = function () {
                        if (req.readyState == 4) {
                            var result = JSON.parse(req.responseText);
                            var mobilephone = result.customerid_contact.mobilephone;
                            var telephone2 = result.customerid_contact.telephone2;
                            phoneObj.primaryNum = formatPhone(mobilephone);
                            phoneObj.secondaryNum = formatPhone(telephone2);
                            (isPrimary) ? callback(phoneObj.primaryNum): callback(phoneObj.secondaryNum);
                        }
                    };
                    req.send(null);
                }
            }
        }
    }
};

/*********************************************************************************
 * Query the CRM database to find the matching record
 * If single record is found, redirect the page to the contact form
 * If multiple records are found, open the search page with result
 *
 *********************************************************************************/
function getRecordInfo(callerNum, singleRecord, duplicatedRecord) {

    var req = new XMLHttpRequest();
    req.open("GET", Xrm.Page.context.getClientUrl() +
        `/api/data/${twAttr.crmVersion}/contacts?$select=${twAttr.contactInfo.entityId},${twAttr.contactInfo.primaryNumField},${twAttr.contactInfo.secondaryNumField}`,
        true);
    req.setRequestHeader("OData-MaxVersion", "4.0");
    req.setRequestHeader("OData-Version", "4.0");
    req.setRequestHeader("Accept", "application/json");
    req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    req.setRequestHeader("Prefer", "odata.include-annotations=\"*\"");
    req.onreadystatechange = function () {
        if (this.readyState === 4) {
            req.onreadystatechange = null;
            if (this.status === 200) {
                var results = JSON.parse(this.response);
                for (var i = 0; i < results.value.length; i++) {
                    var contactid = results.value[i][twAttr.contactInfo.entityId];
                    var
                        primary = formatPhone(results.value[i][twAttr.contactInfo.primaryNumField]);
                    var
                        secondary = formatPhone(results.value[i][twAttr.contactInfo.secondaryNumField]);
                    var theNum = formatPhone(callerNum);
                    twAttr.contactInfo.phoneNumber = theNum;
                    if ((primary == theNum) || (secondary == theNum)) {
                        twAttr.contactInfo.contactList.push(contactid);
                    }
                }
                if (twAttr.contactInfo.contactList.length > 1) {
                    duplicatedRecord();
                    twAttr.contactInfo.contactList.length = 0;
                } else if (twAttr.contactInfo.contactList.length == 1) {
                    singleRecord();
                    twAttr.contactInfo.contactList.length = 0;
                } else {
                    noMatchingRecord();
                }
            } else {
                Xrm.Utility.alertDialog(this.statusText);
            }
        }
    };
    req.send();

}

function noMatchingRecord() {
    var windowOptions = {
        openInNewWindow: true
    };
    var entity = twAttr.searchEntity;
    Xrm.Utility.openEntityForm(entity, null, null, windowOptions);
}

function showSingleRecord() {
    var windowOptions = {
        openInNewWindow: true
    };
    var entity = twAttr.searchEntity;
    var contactId = twAttr.contactInfo.contactList[0];
    Xrm.Utility.openEntityForm(entity, contactId, null, windowOptions);
}

function showDuplicatedRecord() {
    var crmUrl = Xrm.Page.context.getClientUrl();
    var searchValue = twAttr.contactInfo.phoneNumber;
    searchValue = '*' + searchValue.split("").join("*") + '*';
    var searchUrl = crmUrl + twAttr.searchPageString + searchValue;

    // Method 1: Open a new tab with search result
    // window.open(searchUrl);

    // Method 2: Open a new window with search result
    var strWindowFeatures = "location=yes,height=570,width=520,scrollbars=yes,status=yes";
    window.open(searchUrl, "_blank", strWindowFeatures);
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

/*********************************************************************************
 * Twilio Device
 *
 *********************************************************************************/
function getDevice() {

    $.getJSON(twilioTokenUrl)
        .then(function (data) {
            // Setup Twilio.Device
            var device = new Twilio.Device(data.token, {
                codecPreferences: ['opus', 'pcmu'],
                fakeLocalDTMF: true,
                backoffMaxMs: 20000
            });

            window.top.device = device;
            twAttr.clientName = data.identity;

            window.top.device.on('ready', function (device) {
                console.log(`Twilio Device Status: ${device.status()}`);
                setTimeout(function () {
                    $("#clientName", twAttr.iframeDocument).val(twAttr.clientName);
                    $("#callerNumber", twAttr.iframeDocument).val(twAttr.clientName);
                }, 1000);

            });

            window.top.device.on('error', function (error) {
                $('.adaptor-status', twAttr.iframeDocument).css({
                    "background-color": "#929292"
                });
                console.log('Twilio device Error: ' + error.message);
            });

            window.top.device.on('offline', function (device) {
                $('.adaptor-status', twAttr.iframeDocument).css({
                    "background-color": "#929292"
                });
                window.top.device.destroy();
                console.log(`Twilio Device Status: ${device.status()}`);
            });


            window.top.device.on('connect', function (conn) {
                if (!twAttr.isIncomingCall) {
                    console.log(`Connecting the outgoing call to ${conn.customParameters.get("To")}. Connection status: ${conn.status()}`);
                    callStatusHandler(conn.customParameters.get("To"), 'connected');
                    addHangupButtonListener(twAttr.dialerCardHtml, conn);
                    addRecordButtonListner(conn);

                    timeOnCall = twAttr.iframeDocument.getElementsByTagName('h3')[0];
                    timer();
                } else {
                    var incCallNum = conn.parameters.From.slice(2);
                    console.log(`Connecting the incoming call from ${incCallNum}. Connection status: ${conn.status()}`);
                    callStatusHandler(incCallNum, 'call-answered');

                    // add hangup event listener
                    $("#btn-hangup", twAttr.iframeDocument).on("click", function () {
                        $("#incoming-call-card-text", twAttr.iframeDocument).html(twAttr.dialerCardHtml);
                        // hang up the call
                        if (window.top.device) {
                            conn.disconnect();
                        }
                    });
                    addRecordButtonListner(conn);
                    timeOnCall = twAttr.iframeDocument.getElementsByTagName('h3')[0];
                    timer();
                }
            });

            window.top.device.on('disconnect', function (conn) {
                if (!twAttr.isIncomingCall) {
                    callStatusHandler(null, 'disconnected');
                    addCallButtonListner(twAttr.iframeDocument);
                    clearTimeout(time);
                    clearTimer();
                } else {
                    callStatusHandler(null, 'inc-call-end');
                    addCallButtonListner(twAttr.iframeDocument);
                    twAttr.isIncomingCall = false;
                    clearTimeout(time);
                    clearTimer();
                }
                $("#callerNumber", twAttr.iframeDocument).val(twAttr.clientName);
                console.log(`The call has ended. Connection status: ${conn.status()}`);
            });

            window.top.device.on('cancel', function (conn) {
                console.log(`connection cancelled. Connection status: ${conn.status()}`);
                callStatusHandler(null, 'inc-call-end');
                addCallButtonListner(twAttr.iframeDocument);
                twAttr.isIncomingCall = false;
            });

            window.top.device.on('incoming', function (conn) {
                twAttr.isIncomingCall = true;
                var incCallNum = conn.parameters.From.slice(2);
                setIncomingCallHtml(incCallNum);

                console.log('Incoming connection from ' + incCallNum);

                var callerNum = incCallNum;
                var callerNum = callerNum.replace(/^\D+/g, '');
                getRecordInfo(callerNum, showSingleRecord, showDuplicatedRecord);

                // accept the incoming connection and start two-way audio
                twAttr.iframeDocument.getElementById('btn-answer').onclick = function () {
                    if (window.top.device) {
                        conn.accept();
                        console.log('Call accepted. Establishing connection...');
                    }
                };

                twAttr.iframeDocument.getElementById('btn-reject').onclick = function () {
                    if (window.top.device) {
                        conn.reject();
                        callStatusHandler(null, 'inc-call-end');
                        console.log('Call rejected.');
                    }
                };
            });
        })
        .catch(function (err) {
            console.log('Could not get a token from server!' + err);
        });

}


/*********************************************************************************
 * Call Timer
 *
 *********************************************************************************/
function add() {
    seconds++;
    if (seconds >= 60) {
        seconds = 0;
        minutes++;
        if (minutes >= 60) {
            minutes = 0;
            hours++;
        }
    }
    timeOnCall.textContent = (hours ? (hours > 9 ? hours : "0" + hours) : "00") + ":" + (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds);
    timer();
}

function timer() {
    time = setTimeout(add, 1000);
}

function clearTimer() {
    timeOnCall.textContent = "00:00:00";
    seconds = 0;
    minutes = 0;
    hours = 0;
}

/*********************************************************************************
 * Twilio Call UI Handlers
 *
 *********************************************************************************/
function callStatusHandler(number, status) {
    if (status === 'disconnected') {
        $("#dialer-card-text", twAttr.iframeDocument).html(twAttr.dialerCardHtml);

    } else if (status === 'connected') {

        $("#dialer-card-text", twAttr.iframeDocument).hide(0).html(
            `<h1 class="text-center" id="code">Calling</h1>
                        <span>${number}</span>
                        <img src="https://devops365.captorra.com//WebResources/cap_userIcon.png" alt="Unknown User" style="margin-left:auto;margin-right:auto;display:inline-block;">
    
                        <div class="recordContainer" style="position:absolute;left:50%;top:50%;width:50px;height:50px;margin:80px -25px;border-radius:50%;">
                            <input type="checkbox" id="rec-btn" name="checkbox"/>
                            <label for="rec-btn" style="padding-top:45px;font-size:10px;color:#797979;">Record</label>
                        </div>
                
                        <h3><time>00:00:00</time></h3>
                        <div class="btn-group hangup-button" style="top:95px;margin-right:auto;margin-left:auto;">
                        <button type="button" class="incoming-call-button bg-danger" id="btn-hangup">
                        <i class="fas fa-phone-slash"></i>
                        </button>
                        </div>`
        ).delay(200).queue(function (next) {
            $(this).fadeIn();
            next();
        });

    } else if (status === 'inc-call-end') {
        $(".card-body", twAttr.iframeDocument).replaceWith(twAttr.dialerContainer);

    } else if (status === 'call-answered') {

        $("#incoming-call-card-text", twAttr.iframeDocument).hide(0).html(
            `<h1 class="text-center" id="code">Call From</h1>
                        <span>${number}</span>
                        <img src="https://devops365.captorra.com//WebResources/cap_userIcon.png" alt="Unknown User" style="margin-left:auto;margin-right:auto;display:inline-block;">
    
                        <div class="recordContainer" style="position:absolute;left:50%;top:50%;width:50px;height:50px;margin:80px -25px;border-radius:50%;">
                            <input type="checkbox" id="rec-btn" name="checkbox"/>
                            <label for="rec-btn" style="padding-top:45px;font-size:10px;color:#797979;">Record</label>
                        </div>
                        
                        <h3><time id="callTimer">00:00:00</time></h3>
                        <div class="btn-group hangup-button" style="top:95px;margin-right:auto;margin-left:auto;">
                        <button type="button" class="incoming-call-button bg-danger" id="btn-hangup">
                        <i class="fas fa-phone-slash"></i>
                        </button>
                        </div>`
        ).delay(200).queue(function (next) {
            $(this).fadeIn();
            next();
        });
    }
}

/*********************************************************************************
 * Twilio Incoming call UI HTML
 *
 *********************************************************************************/
function setIncomingCallHtml(callFrom) {
    twAttr.dialerContainer = $(".card-body", twAttr.iframeDocument).clone();
    $(".card-body", twAttr.iframeDocument).replaceWith(
        `
        <div class="card-body" style="height:460px;">
        <div class="card-text text-center" id="incoming-call-card-text">
            <span>Call from</span>
            <h2 class="mb-5" id="incoming-call-caller" style="margin-bottom: 2rem!important">${callFrom}</h2>
            <img src="https://devops365.captorra.com//WebResources/cap_userIcon.png" alt="Unknown User">

            <div class="btn-group call-buttons">
                <button type="button" class="incoming-call-button bg-danger" id="btn-reject" onclick="">
                    <i class="fas fa-phone-slash"></i>
                </button>
                <button type="button" class="incoming-call-button bg-success" id="btn-answer" onclick="">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        </div>
        </div>
			`
    );
}

/*********************************************************************************
 * Twilio Event Listeners
 *
 *********************************************************************************/
function addCallButtonListner(iframeDoc) {
    var numbers;

    // Bind button to make call
    $("#call-button", iframeDoc).on("click", function () {
        numbers = $("#number", iframeDoc).val();

        if (window.top.device) {
            if (numbers == "") {
                return false;
            } else {
                var params = {
                    To: numbers
                };

                if (window.top.device.status() === 'ready') {
                    //twAttr.outCallParameter = params.To;
                    window.top.device.connect(params);
                } else {
                    alert(`Failed to connect to Twilio Device.`)
                }
            }
        }
    });
}

function addHangupButtonListener(originalHtml, connection) {
    // add hangup event listener
    $("#btn-hangup", twAttr.iframeDocument).on("click", function () {
        $("#dialer-card-text", twAttr.iframeDocument).html(originalHtml);
        // hang up the call
        if (window.top.device) {
            connection.disconnect();
        }
    });
}


function addRecordButtonListner(connection) {
    // add record event listener
    $('#rec-btn', twAttr.iframeDocument).change(function () {
        if ($(this).is(':checked')) {
            console.log(`Start recording.`);

            var startRecordUrl = `https://api.twilio.com/2010-04-01/Accounts/AC5c1ee6f908adc643add76e4d1c7be1d7/Calls/${connection.parameters.CallSid}/Recordings.json`
            $.ajax({
                url: startRecordUrl,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization",
                        "Basic QUM1YzFlZTZmOTA4YWRjNjQzYWRkNzZlNGQxYzdiZTFkNzozYjI1MTMxNGNlOTU5MDI4YjRhNWZmYzUwZmY5NWExZg=="
                    )
                },
                type: 'POST',
                dataType: 'json',
            }).done(function (data) {
                recordData = data;
            })
        } else {
            console.log(`This call has been recorded.`);

            var stopRecordUrl = `https://api.twilio.com/2010-04-01/Accounts/AC5c1ee6f908adc643add76e4d1c7be1d7/Calls/${connection.parameters.CallSid}/Recordings/${recordData.sid}.json`;
            $.ajax({
                url: stopRecordUrl,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization",
                        `Basic QUM1YzFlZTZmOTA4YWRjNjQzYWRkNzZlNGQxYzdiZTFkNzozYjI1MTMxNGNlOTU5MDI4YjRhNWZmYzUwZmY5NWExZg==`
                    )
                },
                type: 'POST',
                dataType: 'json',
                data: {
                    "Status": "stopped"
                }
            }).done(function (data) {
                console.log(data);
            }).fail(function (jqXHR) {
                console.log(jqXHR);
            })
        }
    });
}


/*********************************************************************************
 * Twilio Iframe 
 *
 *********************************************************************************/
function addIframe() {
    var tw_widget =
        `<div class="handle"></div>
            <iframe class="tw-iframe" id="twilioWidget" src="https://devops365.captorra.com//WebResources/cap_twilioWidget.html" frameborder="0" scrolling = "no"></iframe>`

    // frameOverlay
    var div = window.top.document.createElement('div');
    div.className = 'frameOverlay';
    window.top.document.body.appendChild(div);

    var div = window.top.document.createElement('div');
    div.className = 'draggable';
    div.innerHTML = tw_widget;
    div.style.display = 'none';
    window.top.document.body.appendChild(div);

    // insert javascript
    var t0 = window.top.document.createElement("script");
    t0.type = "text/javascript";
    // t0.src = "https://ajax.googleapis.com/ajax/libs/jquery/3.4.0/jquery.min.js";
    t0.src = "https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js";
    window.top.document.body.appendChild(t0);

    var t1 = window.top.document.createElement("script");
    t1.type = "text/javascript";
    // t1.src = "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.2/jquery-ui.min.js";
    t1.src = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js";
    window.top.document.body.appendChild(t1);

    var s2 = window.top.document.createElement("script");
    s2.type = "text/javascript";
    s2.src = twAttr.cap_draggableUrl;
    window.top.document.body.appendChild(s2);
}

function addCssStyle() {
    // set inline css
    $('body', twAttr.iframeDocument).removeAttr('onfocusout');

    $('.draggable', window.top.document).css({
        position: 'absolute',
        right: '0',
        bottom: '0',
        display: '',
        zIndex: '999'
    });

    $('.handle', window.top.document).css({
        width: '295px',
        backgroundColor: 'transparent',
        borderRadius: '4px',
        height: '49px',
        marginBottom: '-3px',
        position: 'absolute',
        top: '0',
        cursor: 'move'
    });

    $('.frameOverlay', window.top.document).css({
        height: '100%',
        width: '100%',
        background: 'transparent',
        position: 'absolute',
        top: '0',
        left: '0',
        display: 'none'
    });

    $('.tw-iframe', window.top.document).css({
        width: '300px',
        height: '534px',

        // NEW BOX SHA
        boxShadow: '0px 0px 5px 1px rgba(0, 0, 0, 0.18)',
        borderRadius: 'calc(.25rem - 1px) calc(.25rem - 1px) calc(.25rem - 1px) calc(.25rem - 1px)'
    });
}

/*********************************************************************************
 * Twilio Controllers
 *
 *********************************************************************************/
function widgetController() {
    if (!twAttr.isInForm) {
        twAttr.isInForm = Xrm.Page.data ? true : false;
    }

    if (!window.top.document.querySelector("#twilioWidget")) {
        getDevice();
        addIframe();

        var twIframe = window.top.document.getElementById("twilioWidget");
        twIframe.onload = function () {
            twAttr.iframeDocument = twIframe.contentDocument || twIframe.contentWindow.document;

            if (!twAttr.iframeDocument) {
                throw "iframe couldn't be found in DOM.";
            }

            addCallButtonListner(twAttr.iframeDocument);
            twAttr.dialerCardHtml = $("#dialer-card-text", twAttr.iframeDocument).html();


            $("#card-title", twAttr.iframeDocument).on("click", function () {
                var frameHeight = $(".tw-iframe", window.top.document).height();
                var bodyHeight = $("#collapseOne", twAttr.iframeDocument).height();

                var height = ((frameHeight - bodyHeight) > 0) ? (frameHeight - bodyHeight) : (frameHeight + bodyHeight);
                var ratio = ((frameHeight - bodyHeight) > 0) ? 'scale(0.7)' : 'scale(1.0)';

                $(".tw-iframe", window.top.document).height(height);

                $(".draggable", window.top.document).removeAttr('style');
                $(".draggable", window.top.document).css({
                    position: 'absolute',
                    right: '0',
                    bottom: '0',
                    transition: 'transform 0.2s ease',
                    transform: ratio
                });
            });

            addCssStyle();
        }
    } else {
        if (!window.top.device || window.top.device.status() !== 'ready') {
            $(".draggable").remove();
        }
        $(".draggable", window.top.document).css("left", "");
        $(".draggable", window.top.document).css("top", "");
        console.log('The twilio device is already exist!');
    }
}

var twilioCall = (function () {

    var callNum = function (phoneNumType) {
        if (phoneNumType === null) {
            Xrm.Utility.alertDialog("The number you have dialed does not exist.", function () {
                return;
            });
        } else {
            if (!window.top.device) {
                Xrm.Utility.alertDialog("Please login with Twilio Widget.", function () {
                    return;
                });
            } else {
                if (window.top.device.status() === 'ready') {
                    var params = {
                        To: phoneNumType
                    };
                    window.top.device.connect(params);
                } else {
                    $('.adaptor-status', window.top.document).css({
                        "background-color": "#929292"
                    });
                    Xrm.Utility.alertDialog("Failed to connect to Twilio Device. Please refresh the page and try again!", function () {
                        return;
                    });
                }
            }
        }
    }

    var dialPrimary = function () {
        getMobilePhone(true, callNum);
    }

    var dialSecondary = function () {
        getMobilePhone(false, callNum);
    }

    return {
        dialPrimaryPhone: function () {
            dialPrimary();
        },
        dialSecondaryPhone: function () {
            dialSecondary();
        }
    }
})();