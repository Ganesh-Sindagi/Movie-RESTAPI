require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const { response } = require('express');
const { v4: uuidv4 } = require('uuid');
const ejs = require("ejs");

const app = express();

app.use(cors());
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/movieDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = mongoose.Schema({
    email: String,
    password: String,
    googleID: String,
    APP_ID: String,
    APP_KEY: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/movies",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleID: profile.id}, function (err, user) {
        console.log("The user print statment inside ", user)
        if(!user.APP_ID)
        User.updateOne(
            {googleID: user.googleID},
            {APP_ID: uuidv4(), APP_KEY: uuidv4()},
            (err) => {}
        )  
        return cb(err, user);
    });
  }
));

////////////////////////! Schema for movies//////////////////////////////
const movieSchema = mongoose.Schema({
    title: String,
    imdb: String,
    desc: String,
    cast: [String],
    reviews: [String],
    img: String
});

const Movie = mongoose.model("Movie", movieSchema);

//! Routes for auth
app.get("/", (req, res) => {
    res.render("home");
})


app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/movies",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication
    res.redirect("/googleProfile");
});

////////////////////////* Routes for all movies//////////////////////////
app.route("/movies")
    .get((req, res) => {
        console.log(req.query);
        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                Movie.find((err, foundMovies) => {
                    if(!err) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({ data: foundMovies }));
                    } else {
                        res.send(err);
                    }
                }); 
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    })
    .post((req, res) => {

        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                const newMovie = new Movie({
                    title: req.body.title,
                    imdb: req.body.imdb,
                    desc: req.body.desc,
                    cast: req.body.cast,
                    reviews: req.body.reviews,
                    img: req.body.img
                })
        
                newMovie.save((err) => {
                    if(!err) {
                        res.send("Successfully added a new movie!");
                    } else {
                        res.send(err);
                    }
                }) 
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    })
    .delete((req, res) => {
        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                Movie.deleteMany((err) => {
                    if(!err) {
                        res.send("Successfully deleted all movies!");
                    } else {
                        res.send(err);
                    }
                });
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    });

////////////////////? Routes for a specific movie////////////////////////
app.route("/movies/:movieTitle")
    .get((req, res) => {
        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                Movie.findOne({title: req.params.movieTitle}, (err, foundMovie) => {
                    if(!err) {
                        res.send(foundMovie);
                    } else {
                        res.send(err);
                    }
                })
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    })
    .put((req, res) => {
        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                Movie.updateOne(
                    {title: req.params.movieTitle}, 
                    {title: req.body.title, imdb: req.body.imdb, desc: req.body.desc, cast: req.body.cast, reviews: req.body.reviews, img: req.body.img},
                    {overwrite: false},
                    (err) => {
                        if(!err) {
                            res.send("Successfully updated movie!");
                        } else {
                            res.send(err);
                        }
                    }
                )
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    })
    .patch((req, res) => {
        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                Movie.updateOne(
                    {title: req.params.movieTitle},
                    {$set: req.body},
                    (err) => {
                        if(!err) {
                            res.send("Succesfully updated movie!");
                        } else {
                            res.send(err);
                        }
                    }
                )
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    })
    .delete((req, res) => {
        User.findOne({APP_ID: req.query.app_id, APP_KEY: req.query.app_key}, (err, foundUser) => {
            if(foundUser) {
                console.log("foundUser", foundUser);
                Movie.deleteOne({title: req.params.movieTitle}, (err) => {
                    if(!err) {
                        res.send("Successfully deleted the movie!");
                    } else {
                        res.send(err);
                    }
                })
            } else {
                console.log("USERNOTFOUND");
                res.send(err);
            }
        })
    });

//! Local Authentication
app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/profile", (req, res) => {
    if(req.isAuthenticated()){
        console.log("The New request is: ",req.user._id);
        User.findOne({_id: req.user._id}, (err, foundUser) => {
            if(foundUser) {
                console.log("The new found foundUser", foundUser)
                res.render("profile", {foundUser});
            } else {
                res.send(err);
            }
        })
    } else {
        res.redirect("/login")
    }
})

app.get("/googleprofile", (req, res) => {
    console.log("The New request by google is: ",req.user.googleID);
    const reqID = req.user.googleID
    User.findOne({googleID: reqID}, (err, foundUser) => {
        if(foundUser) {
            console.log("The new found foundUser", foundUser)
            res.render("profile", {foundUser});
        } else {
            console.log("USERNOTFOUND")
            res.send(err);
        }
    })
})

app.post("/register", function(req, res){
    console.log(req.body.username);
    console.log(req.body.password);
    User.register({username: req.body.username}, req.body.password, function(err, user){
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
            console.log(req.body)
            User.updateOne(
                {username: req.body.username},
                {APP_ID: uuidv4(), APP_KEY: uuidv4()},
                (err) => {
                    if(!err) {
                        console.log("Succesfully Registered User!");
                        res.redirect("/profile");
                    } else {
                        console.log(err);
                        res.redirect("/register");
                    }
                }
            )  
        });
      }
    });
});
  
app.post("/login", function(req, res){
  
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
  
    req.login(user, function(err){
      if (err) {
        console.log(err);
        res.redirect("/login");
      } else {
        passport.authenticate("local")(req, res, function(){
          console.log("User Successfully Logged In");
          res.redirect("/profile")
        });
      }
    });
  
});

app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

app.listen(5000, function() {
    console.log("REST API endpoint listening on port 5000.");
});
  