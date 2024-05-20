const puppeteer = require("puppeteer");
const fs = require("fs");

const TOKEN = ""; // Token de VoxScript
const CHANNEL = "@YTChannel"; // Cambiar canal con arroa "@"

const getVideoText = async (videoId) => {
  try {
    let chunk = 0;
    let finalTranscript = "";
    let currentTranscript = "";
    let totalChunks = 0;
  
    const response = await fetch(
      `https://voxscript.awt.icu/GetYoutubeVideoData/GetNextYoutubeTranscriptChunk?videoID=${videoId}&transcriptChunkNum=${chunk}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );
    console.log(response);
    const json = await response.json();
    console.log(json);
  
    totalChunks = json.totalChunks;
    currentTranscript = json.transcriptChunk;
    finalTranscript += currentTranscript;
  
    while (chunk < totalChunks - 1) {
      chunk++;
  
      const response = await fetch(
        `https://voxscript.awt.icu/GetYoutubeVideoData/GetNextYoutubeTranscriptChunk?videoID=${videoId}&transcriptChunkNum=${chunk}`,
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
          },
        }
      );
      const json = await response.json();
      currentTranscript = json.transcriptChunk;
      finalTranscript += currentTranscript;
    }
  
    return finalTranscript;
  } catch(err) {
    console.log('Err on processing video: ' + videoId + " going to next video.");
    console.log('Error: ', err);
  }
};

const scrapYoutube = async (target) => {
  if (!target) {
    console.log("Provide a valid target.");
    return;
  }

  try {
    const browser = await puppeteer.launch(); // { headless: true }
    const [page] = await browser.pages();

    // Waits to the link so it can load complety all the scripts (like an SPA)
    await page.goto(`https://www.youtube.com/${target}/videos`, {
      waitUntil: "networkidle0", // Wait until all renders, this is the most important thing about puppeteer
    });
    const data = await page.evaluate(
      () => document.querySelector("*").outerHTML
    );

    let lastCounter = 0;
    let elements = [];
    console.log('Starting to count videos... wait ');
    let INTERVAL_ID = setInterval(async () => {
      let elementsCounter = await page.evaluate(() => {
        const selectedItems = document.querySelectorAll(
          "a.yt-simple-endpoint.inline-block.style-scope.ytd-thumbnail"
        ); // And you can use selectors like a normal page: a[title]#video-title
        return selectedItems.length;
      });

      if (elementsCounter > lastCounter) {
        lastCounter = elementsCounter;
        await page.keyboard.down('End');
      } else {
        console.log('count done, last count: ' + lastCounter);
        clearInterval(INTERVAL_ID);

        elements = await page.evaluate(() => {
          const selectedItems = document.querySelectorAll(
            "a.yt-simple-endpoint.inline-block.style-scope.ytd-thumbnail"
          );

          const articles = [];
          for (let i = 0; i < selectedItems.length; i++) {
            articles.push(selectedItems[i].href);
          }
    
          return articles;
        });

        await browser.close();
        console.log('Confirming count elements: ', elements.length);
        console.log("Links retriveded succesfully, link count: " + elements.length);

        // Filtering the href and obtaining only the id of the youtube video.
        elements = elements
          .filter((element) => element)
          .map((filteredElement) => filteredElement.split("=")[1]);
    
        // Retrieving info of each video by his link with voxscript
        let writeFinalText = "";
        let currentProcessing = 1;
        for (let videoId of elements) {
          console.log('Processing video: ' + videoId + ' number: ' + currentProcessing);
          const finalText = await getVideoText(videoId);
          writeFinalText += finalText;
          console.log('Video processing done.');
          console.log();
          currentProcessing++;
        }
    
        fs.writeFile(`./transcripts/${target}.txt`, writeFinalText, (err) => {
          if (err) {
            console.log(err);
          }
        });
    
        console.log("Job done successfully");
      }
    }, 3000);
  } catch (e) {
    console.log(e);
  }
};


scrapYoutube(CHANNEL); // Cambiar canal
