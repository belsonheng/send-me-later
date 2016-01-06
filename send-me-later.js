if (Meteor.isClient) {
  Template.from.helpers({
    email: function () {
      return Meteor.user().emails[0].address;
    }
  });
  Template.form.rendered = function () {
    // Setup parsley form validation
    $('#new-email').parsley({trigger: 'change'});
  }

  Template.datepicker.rendered = function () {
    $('#date').datepicker();
  }

  Template.form.events({
    "submit form": function (event) {
      event.preventDefault();
      
      var details = { from: event.target.from.value,
                      to: event.target.to.value,
                      subject: event.target.subject.value,
                      message: event.target.message.value,
                      date: new Date(event.target.date.value)
                    }
      Meteor.call("scheduleEmail", details, function (err, response) {
        console.log(err);
        if (response) {
          // Notify response
          sweetAlert("Send Me Later :)", response, "success");
          // Clear the form values
          event.target.to.value = "";
          event.target.subject.value = "";
          event.target.message.value = "";
          event.target.date.value = "";
        } else if (err) {
          sweetAlert("Oops...", "Something went wrong!", "error");
        }
      });
    }
  });
}

if (Meteor.isServer) {
  SendMeLaterEmails = new Meteor.Collection('emails'); // server-side only

  // "details" should be an object containing a date, plus required e-mail details (recipient, content, etc.)

  Meteor.methods({
    scheduleEmail: function (details) {
      if (details.date < new Date()) {
        sendEmail(details);
        return "Sent";
      } else {
        var thisId = SendMeLaterEmails.insert(details);
        addCronMail(thisId, details);       
        return "Scheduled to send on " + details.date;
      }
    }
  });

  function sendEmail (details) {
    console.log("sending email...");  
    Email.send({
      from: details.from,
      to: details.to,
      subject: details.subject,
      text: details.message
    });
    console.log("email sent!");
  }

  function addCronMail (id, details) {
    SyncedCron.add({
      name: id,
      schedule: function (parser) {
        return parser.recur().on(details.date).fullDate();
      },
      job: function () {
        sendEmail(details);
        SendMeLaterEmails.remove(id);
        SyncedCron.remove(id);
        return id;
      }
    });
  }

  Meteor.startup(function () {
    SendMeLaterEmails.find().forEach(function (mail) {
      if (mail.date < new Date()) {
        sendEmail(mail)
      } else {
        addCronMail(mail._id, mail);
      }
    });
    SyncedCron.start();
  });
}
