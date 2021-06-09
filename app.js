require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

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
    googleId: String
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
    callbackURL: "http://localhost:3000/auth/google/movies",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
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
    res.redirect("/auth/google");
})


app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/movies",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/movies");
});

////////////////////////* Routes for all movies//////////////////////////
app.route("/movies")
    .get((req, res) => {
        if(req.isAuthenticated()) {
            Movie.find((err, foundMovies) => {
                if(!err) {
                    res.send(foundMovies);
                } else {
                    res.send(err);
                }
            });
        } else {
            res.redirect("/");
        }
    })
    .post((req, res) => {
        if(req.isAuthenticated()) {
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
            });
        } else {
            res.redirect("/");
        }
    })
    .delete((req, res) => {
        if(req.isAuthenticated()) {
            Movie.deleteMany((err) => {
                if(!err) {
                    res.send("Successfully deleted all movies!");
                } else {
                    res.send(err);
                }
            });
        } else {
            res.redirect("/");
        }
    });

////////////////////? Routes for a specific movie////////////////////////
app.route("/movies/:movieTitle")
    .get((req, res) => {
        if(req.isAuthenticated()) {
            Movie.findOne({title: req.params.movieTitle}, (err, foundMovie) => {
                if(!err) {
                    res.send(foundMovie);
                } else {
                    res.send(err);
                }
            })
        } else {
            res.redirect("/");
        }
    })
    .put((req, res) => {
        if(req.isAuthenticated()) {
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
            res.redirect("/");
        }
    })
    .patch((req, res) => {
        if(req.isAuthenticated()) {
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
            res.redirect("/");
        }
    })
    .delete((req, res) => {
        if(req.isAuthenticated()) {
            Movie.deleteOne({title: req.params.movieTitle}, (err) => {
                if(!err) {
                    res.send("Successfully deleted the movie!");
                } else {
                    res.send(err);
                }
            })
        } else {
            res.redirect("/");
        }
    });

//! Local Authentication  
app.post("/register", function(req, res){
  
    User.register({username: req.body.username}, req.body.password, function(err, user){
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/movies");
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
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/movies");
        });
      }
    });
  
});

app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

app.listen(3000, function() {
    console.log("REST API endpoint listening on port 3000.");
});
  