var fs = require('fs');
var request = require('request');

var config = JSON.parse(fs.readFileSync(process.argv[2] || 'config.json', 'UTF-8'));

var pagerduty_auth = "Basic " + new Buffer(config.pagerduty.username + ":" + config.pagerduty.password).toString("base64");
var campfire_auth = "Basic " + new Buffer(config.campfire.api_key + ":X").toString("base64");

var count = 0;

// Call this callback every config.polling_interval
setInterval(function() {
  // Check how many active incidents we have. 
  request.get(
    {
      url: "https://" + config.pagerduty.domain + "/api/v1/incidents/count?status=triggered,acknowledged&service=" + config.pagerduty.service,
      headers : {
        "Authorization" : pagerduty_auth
      }
    },
    function (err, res, body) {
      if (err) {
        console.log(err);
      }
      else {
        data = JSON.parse(body);
        // If the number of active incidents have changed since last report, do this thingie
        if (data.total != count) {
          // Request a list of all active incidents
          request.get(
            {
              url: "https://" + config.pagerduty.domain + "/api/v1/incidents?status=triggered,acknowledged&service=" + config.pagerduty.service,
              headers : {
                "Authorization" : pagerduty_auth
              }
            },
            function (err, res, body) {
              if (err) {
                console.log(err);
              }
              data = JSON.parse(body);

              // Build a summary of the active incidents
              var message = {};
              message.message = {};
              message.message.body = "Number of active incidents changed from " + count + " to " + data.total + ". Here's a list of all currently active incidents:\n";
              data.incidents.map(function(incident) {
                message.message.body += "\nIncident #" + incident.incident_number + " - '" + incident.incident_key + "'\nAssigned to '" + incident.assigned_to_user.name + "' with the status '" + incident.status + "'\n" + incident.html_url;
              });

              // Send the summary to Campfire
              request.post(
                {
                  url: "https://" + config.campfire.domain + "/room/" + config.campfire.room + "/speak.json",
                  headers : {
                    "Authorization" : campfire_auth,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify(message)
                },
                function (err, res, body) {
                  if (err) {
                    console.log(err);
                  }
                }
              );
              console.log(message);
              count = data.total;
            }
          );
        };
      }
    }
  );
}, config.polling_interval);