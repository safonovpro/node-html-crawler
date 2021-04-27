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

const domain = process.argv[2];
if (process.argv[3] === 'help') {
    console.log('Command is node application.js <domain> [snake[, cat][, car][, church]]'); 
    process.exit(0);
}

const availableTypes = ['snake', 'cat', 'car', 'church'];
let wantedTypes = [];
for (let i = 3; i < process.argv.length; i++)
    if (availableTypes.find( (e) => e === process.argv[i]))
        wantedTypes.push(process.argv[i]);
    else {
        console.log('Error. Image type not supported!'); 
        console.log('Run `node application.js help` for more info!');
        process.exit(0);
    }

let model;

async function loadModel() {
    console.log("Model is loading...");
    model = await mobilenet.load();
    console.log("Model loaded successfully!");
};

function deleteImage(pathWithFileName) {
    console.log('Image', pathWithFileName, 'doesn\'t have valid content. To be deleted.');
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

    /* If there's no comma the returned array will have a single element, the whole string. */
    let commaStrings = predictions[0].className.split(',');
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
  //console.log("path: ", pathWithFileName);
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
          //console.log('The picture could contain: ', predictions);

          /* Remove image file from disk if it is not of wanted type. */
          if (!hasType(predictions)) 
            deleteImage(pathWithFileName);

      }
      else {
          console.log("Error: ");
          console.log(err);

          /* Remove image file from disk if error found on transforming it to Tensor3d object. */
          deleteImage(pathWithFileName);
      }

  });
}

const crawler = new Crawler(domain);
loadModel().then( value => crawler.crawl());
 
crawler.on('data', (data) => {
    //console.log(data.result.statusCode, data.url);
    
    options = {
        url: data.url,
        dest: process.cwd() + '/download',
    };

    download.image(options)
        .then(({ filename }) => {

            /* Saved to options.dest directory. */
            console.log('Saved to', filename, 'for content evaluation.');  
            predictImage(filename);

        }) 
        .catch((err) => console.error(err));
});
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain ${domain} were crawled!`));
