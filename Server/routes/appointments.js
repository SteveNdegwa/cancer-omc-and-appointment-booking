const express = require("express");
const router = express.Router();

const pool = require("../server.js");

const path = require("path");
const { log } = require("console");

router.get("/customize-appointment-slots", (req, res) => {
  if (req.session.authenticated) {
    res.render("appointment-slots");
  } else {
    res.redirect("/login");
  }
});

router.post("/customize-appointment-slots", (req, res) => {
  if (req.session.authenticated) {
    let days = [];
    if (req.body.sunday == "on") {
      days.push("sunday");
    }
    if (req.body.monday == "on") {
      days.push("monday");
    }
    if (req.body.tuesday == "on") {
      days.push("tuesday");
    }
    if (req.body.wednesday == "on") {
      days.push("wednesday");
    }
    if (req.body.thursday == "on") {
      days.push("thursday");
    }
    if (req.body.friday == "on") {
      days.push("friday");
    }
    if (req.body.saturday == "on") {
      days.push("saturday");
    }

    let slotsNo = req.body.slots - 1;

    let time = [];

    for (let i = 1; i <= slotsNo; i++) {
      time.push(req.body["time" + i]);
    }

    let timeJson = JSON.stringify(time);

    pool.getConnection((err, connection) => {
      if (err) console.log(err);
      else {
        const save = new Promise((resolve, reject) => {
          days.forEach((day) => {
            const query =
              "SELECT * FROM appointment_slots WHERE doctor_id= ? AND day = ?";
            connection.query(
              query,
              [req.session.userId, day],
              (err, result) => {
                if (err) console.log(err);

                if (result.length) {
                  const query =
                    "UPDATE appointment_slots SET slots=? WHERE doctor_id =? AND day =?";
                  connection.query(
                    query,
                    [timeJson, req.session.userId, day],
                    (err, data) => {
                      if (err) console.log(err);
                      else {
                        console.log(`${day} updated successfully`);
                      }
                    }
                  );
                } else {
                  const query =
                    "INSERT INTO appointment_slots(`doctor_id`, `day`, `slots`) VALUES(?)";
                  const values = [req.session.userId, day, timeJson];
                  connection.query(query, [values], (err, data) => {
                    if (err) console.log(err);
                    else {
                      console.log(`${day} inserted successfully`);
                    }
                  });
                }
              }
            );
          });
        });
      }
      return res.redirect("/");
      connection.release();
    });
  } else {
    return res.redirect("/login");
  }
});

let appointmentSlots = [];
let details = [];
let chosenDate = "";

router.get("/book-appointment", (req, res) => {
  if (req.session.authenticated) {
    pool.getConnection((err, connection) => {
      const query =
        "SELECT name, cancer_speciality, clinic_location, clinic_phone_no, clinic_email FROM doctor_details where user_id = ?";
      connection.query(query, [req.session.doctorId], (err, results) => {
        if (err) console.log(err);
        else {
          console.log(results);

          var string = JSON.stringify(results);
          var details = JSON.parse(string);

          appointmentSlots = [];
          chosenDate = "";

          return res.render("book-appointment", {
            details: details,
            appointmentSlots: appointmentSlots,
            chosenDate: chosenDate,
            bookingMessage: req.flash("bookingMessage"),
          });
        }
      });
      connection.release();
    });
  } else {
    res.redirect("/login");
  }
});

router.post("/book-appointment", (req, res) => {
  if (req.session.authenticated) {
    if (req.body.submitType == "date change") {
      /// reload after date change

      const getDetails = new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
          const query =
            "SELECT name, cancer_speciality, clinic_location, clinic_phone_no, clinic_email FROM doctor_details where user_id = ?";
          connection.query(query, [req.session.doctorId], (err, results) => {
            if (err) throw err;
            else {
              console.log(results);

              var string = JSON.stringify(results);
              details = JSON.parse(string);

              resolve(details);
            }
          });
          connection.release();
        });
      });

      getDetails.then((details) => {
        appointmentSlots = [];
        chosenDate = req.body.date;

        let date = new Date(req.body.date);

        let weekdays = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        let dayIndex = date.getDay();
        let day = weekdays[dayIndex];

        pool.getConnection((err, connection) => {
          const query =
            "SELECT slots FROM appointment_slots where doctor_id = ? AND day = ?";
          connection.query(
            query,
            [req.session.doctorId, day],
            (err, results) => {
              if (err) throw err;

              if (results.length) {
                console.log(results);
                console.log(results[0].slots);
                console.log(JSON.parse(results[0].slots));

                appointmentSlots = JSON.parse(results[0].slots);
              }

              return res.render("book-appointment", {
                details: details,
                appointmentSlots: appointmentSlots,
                chosenDate: chosenDate,
                bookingMessage: req.flash("bookingMessage"),
              });
            }
          );
          connection.release();
        });
      });
    } else {
      //// for saving appointments to the database  // check if more than two selected  //add

      let selectedTime = "";
      let selectedDate = req.body.date;

      appointmentSlots.forEach((slot) => {
        if (req.body[slot] == "on") {
          selectedTime = slot;
        }
      });

      if (selectedTime == "") {
        req.flash("bookingMessage", "Please Select A Time Slot");
        return res.render("book-appointment", {
          details: details,
          appointmentSlots: appointmentSlots,
          chosenDate: chosenDate,
        });
      } else {
        pool.getConnection((err, connection) => {
          if (err) throw err;
          else {
            const query =
              "SELECT * FROM appointments WHERE doctor_id = ? AND date = ? and time= ?";
            connection.query(
              query,
              [req.session.doctorId, selectedDate, selectedTime],
              (err, result) => {
                if (err) throw err;
                if (result.length) {
                  console.log("already booked");
                  req.flash(
                    "bookingMessage",
                    "Appointment Slot Already Booked"
                  );
                  return res.render("book-appointment", {
                    details: details,
                    appointmentSlots: appointmentSlots,
                    chosenDate: chosenDate,
                    bookingMessage: req.flash("bookingMessage"),
                  }); //ALREADY BOOKED
                } else {
                  const query2 =
                    "INSERT INTO appointments(`doctor_id`,`patient_id`, `date`, `time`) VALUES(?)";
                  const values2 = [
                    req.session.doctorId,
                    req.session.userId,
                    selectedDate,
                    selectedTime,
                  ];
                  connection.query(query2, [values2], (err, data) => {
                    if (err) throw err;
                    else {
                      console.log("appointment inserted");
                      console.log(`appointment id is ${data.insertId}`);
                      res.redirect("/");
                    }
                  });
                }
              }
            );
          }
          connection.release();
        });
      }
      console.log(selectedTime);
    }
  } else {
    res.redirect("/login");
  }
});

module.exports = router;