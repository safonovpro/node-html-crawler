/* eslint-disable no-console */

/*
The class names returned by MobileNet are as follows: 

Snakes: 
    thunder snake
    ringneck snake
    hognose snake
    green snake
    king snake
    garter snake
    water snake
    vine snake
    night snake
    boa constrictor
    rock python
    Indian cobra
    green mamba
    sea snake
    horned viper
Cats:
    tabby
    tiger cat
    Persian cat
    Siamese cat
    Egyptian cat
Cars:
    sports car
Churches:
    church
*/

const Crawler = require('./crawler.js');
const download = require('image-downloader')
const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');
const fs = require('fs');

/* Webp images not supported. */
const image = require('get-image-data');

var path = require('path');

var express = require('express');
var app = express();
var http = require('http').Server(app);

var io = require('socket.io')(http, {
    connectTimeout: 100000,
    pingInterval: 100000,
    pingTimeout: 100000
});

var port = process.env.PORT || 3000;

var events = require('events');
var eventEmitter = new events.EventEmitter();

app.use(express.static('download'));
app.use(express.static('public'));
app.use(express.urlencoded({
  extended: true
}));

http.listen(port, function(){
  console.log('Server is listening for clients on port ' + port + '.');
});

/*
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});
*/

app.get('/', function(req, res){
  res.sendFile(__dirname + '/start.html');
});

let wantedTypes = [];
let model;

async function loadModel() {
    console.log("Model is loading...");
    model = await mobilenet.load();
    console.log("Model loaded successfully!");
};

app.post('/submit-search', (req, res) => {

  console.log("domain: " + req.body.domain);
  console.log("car: " + req.body.car);
  console.log("any: " + req.body.any);

  if (req.body.any === undefined) {
    if (req.body.car)
      wantedTypes.push(req.body.car);
    if (req.body.cat)
      wantedTypes.push(req.body.cat);
    if (req.body.church)
      wantedTypes.push(req.body.church);
    if (req.body.snake)
      wantedTypes.push(req.body.snake);
    if (req.body.volcano)
      wantedTypes.push(req.body.volcano);
    if (req.body.fox)
      wantedTypes.push(req.body.fox);
  }

  console.log("arr:");
  console.log(wantedTypes);

  eventEmitter.emit('start_crawling', req.body.domain);

  res.sendFile(__dirname + '/index.html');
  
});

eventEmitter.on('logging', function(message) {
  io.emit('log_message', message);
});


// Override console.log
var originConsoleLog = console.log;
console.log = function(data) {
  eventEmitter.emit('logging', data);
  originConsoleLog(data);
};

function moveImage(pathWithFileName) {
    var newPath = __dirname + '/download/bad_images/' + path.basename(pathWithFileName); 

    fs.rename(pathWithFileName, newPath, function (err) {
      if (err) throw err
      io.emit('bad_image', path.basename(newPath));
    })

};

function deleteImage(pathWithFileName) {
    console.log('Can\'t transform image ', pathWithFileName, ' into a Tensor object. To be deleted.');
    fs.unlinkSync(pathWithFileName, (error) => {
        if (error) {
            console.error(error);
        }
    });
};

function hasType(predictions) {

    /* If isn't any wanted type keep all images. */
    if (!wantedTypes.length)
        return true;

    let type;

    /* predictions[0].className could look like "string string, string string" 
       or "string, string" or "string" */
    let commaStrings = predictions[0].className.split(',');

    /* spaceStrings could look like "string string" or "string" */
    let spaceStrings = commaStrings[0].split(' ');
    if (spaceStrings.length === 1)
        type = spaceStrings[0];
    else
        type = spaceStrings[1];

    if (type === 'constrictor' || type === 'cobra' || 
        type === 'mamba' || type === 'viper' || type === 'python')
        type = 'snake';

    if (type === 'tabby')
        type = 'cat';
        
    if (wantedTypes.find( (e) => e === type) && predictions[0].probability > 0.7)
        return true;
    
    return false;
}

const predictImage = async (pathWithFileName) => {
  await image(pathWithFileName, async (err, imageData) => {

      if (imageData) {

          /* Pre-process image. */
          const numChannels = 3;
          const numPixels = imageData.width * imageData.height;
          const values = new Int32Array(numPixels * numChannels);
          const pixels = imageData.data;
          for (let i = 0; i < numPixels; i++) {
            for (let channel = 0; channel < numChannels; ++channel) {
              values[i * numChannels + channel] = pixels[i * 4 + channel];
            }
          }
          const outShape = [imageData.height, imageData.width, numChannels];
          const input = tf.tensor3d(values, outShape, 'int32');

          const predictions = await model.classify(input);

          /* Move image file if it is not of wanted type. */
          if (!hasType(predictions)) 
            moveImage(pathWithFileName);
          else {
            io.emit('ok_image', path.basename(pathWithFileName));
          }
      }
      else {
          console.log("Error: ");
          console.log(err);

          /* Remove image file from disk if error found on transforming it to Tensor3d object. */
          deleteImage(pathWithFileName);
      }

  });
}


  /* If for more than 60 seconds we don't receive a message 
     from crawler it means the search ended. */ 
  var time;
  function increaseCheckTime() {
    time += 1;

    if (time >= 50) 
        console.log("Search will stop in " +  (61 - time) + " seconds.");

    if (time > 60) {
      // make all Socket instances disconnect
      io.disconnectSockets();
      console.log("Socket server disconnected.");
    }
  }

eventEmitter.on('start_crawling', function(message) {

  console.log("message:" + message +"x");

  const crawler = new Crawler(message);
  loadModel().then( value => crawler.crawl());

  time = 0;
  setInterval(increaseCheckTime, 1000);

  crawler.on('data', (data) => {
    

      /* Reset counter if we get a new message from crawler. */ 
      time = 0;

      if (data.url.endsWith('.jpg') || data.url.endsWith('.jpeg') || data.url.endsWith('.png')) {
          options = {
              url: data.url,
              dest: process.cwd() + '/download',
          };
          download.image(options)
              .then(({ filename }) => {

                  /* Saved to options.dest directory. */
                  console.log('Image ' + path.basename(filename) + ' saved to ' + path.dirname(filename) + 
                    ' for content evaluation.');  
          
                  predictImage(filename);

              }) 
              .catch((err) => console.error(err));
      }
      else
          console.log("Patience please. We're at " + data.url + " digging right now.");      
  });
  crawler.on('error', (error) => console.error(error));
  crawler.on('end', () => console.log(`Finish! All urls on domain were crawled!`));

});


/*
const crawler = new Crawler("localhost/candd/gallery");
loadModel().then( value => crawler.crawl());

crawler.on('data', (data) => {
    if (data.url.endsWith('.jpg') || data.url.endsWith('.jpeg') || data.url.endsWith('.png')) {
        options = {
            url: data.url,
            dest: process.cwd() + '/download',
        };
        download.image(options)
            .then(({ filename }) => {

                console.log('Image ' + path.basename(filename) + ' saved to ' + path.dirname(filename) + 
                  ' for content evaluation.');  
        
                predictImage(filename);

            }) 
            .catch((err) => console.error(err));
    }
    else
        console.log("Patience please. We're at " + data.url + " digging right now.");      
});
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain were crawled!`));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});
*/

