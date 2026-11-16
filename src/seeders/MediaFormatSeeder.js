const { MediaFormat } = require("../models");
const initialFormats = require("./mediaFormats");

const seedMediaFormats = async () => {
  for (const format of initialFormats) {
    await MediaFormat.findOrCreate({
      where: { extension: format.extension },
      defaults: {
        ...format,
        isAllowed: true
      }
    });
  }

  console.log("Media formats initialized.");
};

 seedMediaFormats();