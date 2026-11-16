
const initialFormats = [
  {
    extension: "jpg",
    mimeTypes: ["image/jpeg", "image/pjpeg"],
    category: "image"
  },
  {
    extension: "jpeg",
    mimeTypes: ["image/jpeg", "image/pjpeg"],
    category: "image"
  },
  {
    extension: "png",
    mimeTypes: ["image/png"],
    category: "image"
  },
  {
    extension: "gif",
    mimeTypes: ["image/gif"],
    category: "image"
  },
  {
    extension: "mp3",
    mimeTypes: ["audio/mpeg", "audio/mp3"],
    category: "audio"
  },
  {
    extension: "mp4",
    mimeTypes: ["video/mp4"],
    category: "video"
  },
  {
    extension: "wav",
    mimeTypes: ["audio/wav", "audio/x-wav"],
    category: "audio"
  },
  {
    extension: "m4a",
    mimeTypes: ["audio/mp4", "audio/x-m4a"],
    category: "audio"
  },
  {
    extension: "ogg",
    mimeTypes: ["audio/ogg", "application/ogg"],
    category: "audio"
  },
  {
    extension: "pdf",
    mimeTypes: ["application/pdf"],
    category: "document"
  },
  {
    extension: "doc",
    mimeTypes: ["application/msword"],
    category: "document"
  },
  {
    extension: "docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    category: "document"
  },
  {
    extension: "xls",
    mimeTypes: ["application/vnd.ms-excel"],
    category: "document"
  },
  {
    extension: "xlsx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ],
    category: "document"
  },
  {
    extension: "ppt",
    mimeTypes: ["application/vnd.ms-powerpoint"],
    category: "document"
  },
  {
    extension: "pptx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ],
    category: "document"
  },
  {
    extension: "zip",
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    category: "archive"
  },
  {
    extension: "rar",
    mimeTypes: ["application/vnd.rar", "application/x-rar-compressed"],
    category: "archive"
  },
  {
    extension: "txt",
    mimeTypes: ["text/plain"],
    category: "document"
  },
  {
    extension: "csv",
    mimeTypes: ["text/csv", "application/csv"],
    category: "document"
  }
];

module.exports = initialFormats;
