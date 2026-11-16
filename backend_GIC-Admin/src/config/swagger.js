const swaggerJsdoc = require("swagger-jsdoc");
const envConfig = require("./envConfig");


const options = {
  definition: {
    openapi: "3.0.3",

    info: {
      title: "GIC Admin CMS API",
      version: "2.0.0",
      description:
        "API documentation for managing CMS languages, menus, menu translations, pages, HTML content, publishing and soft deletion. Also exposes public website content APIs for languages, navigation and published pages.",
    },

 servers: [
      {
        url: envConfig.API_BASE_URL,
        description: "LAN testing server",
      },
      {
        url: envConfig.API_BASE_URL_ALT,
        description: "Alternate API server",
      },
      {
        url: "http://localhost:" + envConfig.PORT,
        description: "Local development server",
      },
    ],

    tags: [
      { name: "Health", description: "API health check" },
      { name: "Languages", description: "Manage CMS languages" },
      { name: "Menus", description: "Manage logical navigation menus" },
      {
        name: "Menu Translations",
        description: "Manage language-specific menu titles and URLs",
      },
      {
        name: "Pages",
        description: "Manage pages and their HTML content",
      },
      {
        name: "Public Content",
        description:
          "Public website APIs for languages, navigation and published page content",
      },
    ],

    components: {
      parameters: {
        Id: {
          name: "id",
          in: "path",
          required: true,
          description: "Positive numeric resource ID",
          schema: { type: "integer", minimum: 1 },
        },
      },

      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Operation successful.",
            },
            data: {
              description: "Response data, depending on the endpoint",
              nullable: true,
            },
            code: {
              type: "string",
              example: "MENU_URL_ALREADY_EXISTS",
            },
          },
        },

        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Resource not found.",
            },
            field: {
              type: "string",
              example: "menuURL",
            },
            code: {
              type: "string",
              example: "MENU_URL_ALREADY_EXISTS",
            },
          },
        },

        // ------------------------------------------
        // LANGUAGE SCHEMAS
        // ------------------------------------------

        Language: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              maxLength: 100,
              example: "English",
            },
            code: {
              type: "string",
              maxLength: 10,
              example: "en",
              description: "Language code, such as en or hi",
            },
            isPublished: {
              type: "boolean",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        LanguageInput: {
          type: "object",
          required: ["name", "code"],
          properties: {
            name: {
              type: "string",
              maxLength: 100,
              example: "English",
            },
            code: {
              type: "string",
              maxLength: 10,
              example: "en",
            },
            isPublished: {
              type: "boolean",
              default: true,
              example: true,
            },
          },
        },

        LanguageUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            name: {
              type: "string",
              maxLength: 100,
              example: "Hindi",
            },
            code: {
              type: "string",
              maxLength: 10,
              example: "hi",
            },
            isPublished: {
              type: "boolean",
              example: true,
            },
          },
        },

        // ------------------------------------------
        // PUBLIC CONTENT SCHEMAS
        // ------------------------------------------

        PublicLanguage: {
          type: "object",
          properties: {
            publicId: {
              type: "string",
              example: "eyJpZCI6IjEifQ...",
              description:
                "Encrypted language ID used by public website APIs",
            },
            name: {
              type: "string",
              maxLength: 100,
              example: "English",
            },
            code: {
              type: "string",
              maxLength: 10,
              example: "en",
              description: "Language code",
            },
          },
        },

        PublicMenuNode: {
          type: "object",
          properties: {
            menuPublicId: {
              type: "string",
              example: "eyJpZCI6IjEifQ...",
              description:
                "Encrypted logical menu ID. This ID remains the same across languages.",
            },
            publicId: {
              type: "string",
              example: "eyJpZCI6IjExIn0...",
              description:
                "Encrypted menu translation ID for the selected language.",
            },
            title: {
              type: "string",
              example: "About Us",
            },
            url: {
              type: "string",
              example: "/about-us",
            },
            children: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PublicMenuNode",
              },
            },
          },
        },

        PublicPageContent: {
          type: "object",
          properties: {
            title: {
              type: "string",
              example: "About Us",
            },
            url: {
              type: "string",
              example: "/about-us",
            },
            content: {
              nullable: true,
              oneOf: [
                {
                  type: "string",
                  example:
                    "<section><h1>About Us</h1><p>Welcome to GIC.</p></section>",
                },
                {
                  type: "null",
                },
              ],
              description:
                "Trusted HTML content. Null indicates that the frontend should render a custom React page.",
            },
            language: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  example: "English",
                },
                code: {
                  type: "string",
                  example: "en",
                },
              },
            },
          },
        },

        // ------------------------------------------
        // MENU SCHEMAS
        // ------------------------------------------

        MenuInput: {
          type: "object",
          required: ["languageId", "menuTitle", "menuURL"],
          properties: {
            languageId: {
              type: "integer",
              minimum: 1,
              example: 1,
              description:
                "Language ID for the first menu translation",
            },
            menuTitle: {
              type: "string",
              maxLength: 255,
              example: "About Us",
            },
            menuURL: {
              type: "string",
              maxLength: 500,
              example: "/en/about-us",
              description:
                "URL must be unique among active translations in the same language",
            },
            parentId: {
              type: "integer",
              nullable: true,
              minimum: 1,
              example: null,
              description:
                "Parent menu ID, or null for a top-level menu",
            },
            isPublished: {
              type: "boolean",
              default: false,
              example: false,
            },
          },
        },

        MenuUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            parentId: {
              type: "integer",
              nullable: true,
              minimum: 1,
              example: 2,
              description:
                "Change parent menu; use null for a top-level menu",
            },
            isPublished: {
              type: "boolean",
              example: true,
            },
          },
          description:
            "Updates common menu properties only. Use the translation endpoints to update menuTitle or menuURL.",
        },

        // ------------------------------------------
        // MENU TRANSLATION SCHEMAS
        // ------------------------------------------

        MenuTranslationInput: {
          type: "object",
          required: ["languageId", "menuTitle", "menuURL"],
          properties: {
            languageId: {
              type: "integer",
              minimum: 1,
              example: 2,
              description:
                "Language ID for the new translation",
            },
            menuTitle: {
              type: "string",
              maxLength: 255,
              example: "हमारे बारे में",
            },
            menuURL: {
              type: "string",
              maxLength: 500,
              example: "/hi/hamare-bare-mein",
            },
          },
        },

        MenuTranslationUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            menuTitle: {
              type: "string",
              maxLength: 255,
              example: "About GIC",
            },
            menuURL: {
              type: "string",
              maxLength: 500,
              example: "/en/about-gic",
            },
          },
          description:
            "Updates the title or URL of an existing translation. The language cannot be changed through this endpoint.",
        },

        MenuTranslationSummary: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 11,
            },
            menuId: {
              type: "integer",
              example: 1,
            },
            languageId: {
              type: "integer",
              example: 1,
            },
            menuTitle: {
              type: "string",
              example: "About Us",
            },
            menuURL: {
              type: "string",
              example: "/en/about-us",
            },
            isDeleted: {
              type: "boolean",
              example: false,
            },
            language: {
              $ref: "#/components/schemas/Language",
            },
          },
        },

        MenuTreeNode: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            parentId: {
              type: "integer",
              nullable: true,
              example: null,
            },
            isPublished: {
              type: "boolean",
              example: true,
            },
            translations: {
              type: "array",
              items: {
                $ref: "#/components/schemas/MenuTranslationSummary",
              },
            },
            children: {
              type: "array",
              items: {
                $ref: "#/components/schemas/MenuTreeNode",
              },
            },
          },
        },

        // ------------------------------------------
        // PAGE SCHEMAS
        // ------------------------------------------

        PageInput: {
          type: "object",
          required: ["menuTranslationId", "content"],
          properties: {
            menuTranslationId: {
              type: "integer",
              minimum: 1,
              example: 11,
              description:
                "Existing active MenuTranslation ID. Language and menu are derived from this record.",
            },
            content: {
              type: "string",
              example:
                "<section><h1>Welcome to GIC</h1><p>Page content</p></section>",
              description:
                "HTML content for this menu translation",
            },
            isPublished: {
              type: "boolean",
              default: false,
              example: false,
            },
          },
        },

        PageUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            content: {
              type: "string",
              example:
                "<section><h1>Updated content</h1></section>",
            },
            isPublished: {
              type: "boolean",
              example: true,
            },
          },
          description:
            "Only content and publication status can be updated. A page cannot be reassigned to another menu translation.",
        },

        ContentInput: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "string",
              example:
                "<section><h1>Welcome</h1><p>Page content</p></section>",
              description: "HTML content to save",
            },
          },
        },

        Page: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 5,
            },
            menuTranslationId: {
              type: "integer",
              example: 11,
            },
            content: {
              type: "string",
              example: "<h1>About Us</h1>",
            },
            isPublished: {
              type: "boolean",
              example: false,
            },
            isDeleted: {
              type: "boolean",
              example: false,
            },
            menuTranslation: {
              $ref: "#/components/schemas/MenuTranslationSummary",
            },
          },
        },
      },
    },
  },

  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

// ----------------------------------------------
// SHARED HELPERS
// ----------------------------------------------

const idParam = [
  {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
    description: "Positive numeric resource ID",
  },
];

const encryptedLanguageParam = {
  name: "encryptedLanguageId",
  in: "path",
  required: true,
  schema: {
    type: "string",
    minLength: 1,
  },
  description:
    "Encrypted language ID returned by the public languages endpoint",
};

const encryptedMenuParam = {
  name: "encryptedMenuId",
  in: "path",
  required: true,
  schema: {
    type: "string",
    minLength: 1,
  },
  description:
    "Encrypted logical menu ID returned by the public navigation endpoint",
};

const translationParams = [
  ...idParam,
  {
    name: "menuTranslationId",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
    description: "Menu translation ID",
  },
];

const jsonBody = (schemaName) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        $ref: `#/components/schemas/${schemaName}`,
      },
    },
  },
});

const standardResponses = {
  400: {
    description: "Invalid request or validation error",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ErrorResponse",
        },
      },
    },
  },
  404: {
    description: "Resource not found",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ErrorResponse",
        },
      },
    },
  },
  500: {
    description: "Internal server error",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ErrorResponse",
        },
      },
    },
  },
};

const successResponse = (description = "Operation successful") => ({
  description,
  content: {
    "application/json": {
      schema: {
        $ref: "#/components/schemas/ApiResponse",
      },
    },
  },
});

const operation = (tag, summary, extra = {}) => {
  const {
    responses: extraResponses = {},
    ...otherOptions
  } = extra;

  return {
    tags: [tag],
    summary,
    responses: {
      200: successResponse(),
      ...standardResponses,
      ...extraResponses,
    },
    ...otherOptions,
  };
};

// ----------------------------------------------
// API PATHS
// ----------------------------------------------

swaggerSpec.paths = {
  // --------------------------------------------
  // HEALTH
  // --------------------------------------------

  "/health": {
    get: {
      tags: ["Health"],
      summary: "Check API health",
      responses: {
        200: {
          description: "API is running",
        },
      },
    },
  },

  // --------------------------------------------
  // PUBLIC CONTENT
  // --------------------------------------------

  "/api/languages/public": {
    get: {
      tags: ["Public Content"],
      summary: "Get published languages for the public website",
      description:
        "Returns all published and active languages that can be selected by the public website.",
      responses: {
        200: {
          description: "Published languages retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  message: {
                    type: "string",
                    example: "Languages retrieved successfully.",
                  },
                  data: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/PublicLanguage",
                    },
                  },
                },
              },
            },
          },
        },
        404: {
          description: "No published languages found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
      },
    },
  },

  "/api/menu-translations/navmenus/{encryptedLanguageId}": {
    get: {
      tags: ["Public Content"],
      summary: "Get public navigation menu hierarchy",
      description:
        "Returns the published navigation hierarchy for the selected language. Only published and non-deleted menus and active translations are returned.",
      parameters: [encryptedLanguageParam],
      responses: {
        200: {
          description:
            "Published navigation hierarchy retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  message: {
                    type: "string",
                    example:
                      "Navigation menus retrieved successfully.",
                  },
                  data: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/PublicMenuNode",
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description:
            "Invalid or malformed encrypted language ID",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
        404: {
          description:
            "Language not found or no published navigation available",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
      },
    },
  },

  "/api/pages/content/{encryptedMenuId}/{encryptedLanguageId}": {
    get: {
      tags: ["Public Content"],
      summary: "Get published page content",
      description:
        "Returns the published page content for a logical menu in the selected language. The menu ID and language ID are encrypted. Only published menus, published languages and published pages are returned.",
      parameters: [encryptedMenuParam, encryptedLanguageParam],
      responses: {
        200: {
          description:
            "Published page content retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  message: {
                    type: "string",
                    example:
                      "Page content retrieved successfully.",
                  },
                  data: {
                    $ref: "#/components/schemas/PublicPageContent",
                  },
                },
              },
            },
          },
        },
        400: {
          description:
            "Invalid or malformed encrypted parameters",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
        404: {
          description:
            "Published page was not found for the selected menu and language",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
      },
    },
  },

  // --------------------------------------------
  // LANGUAGES (admin)
  // --------------------------------------------

  "/api/languages": {
    get: operation("Languages", "Get all languages"),

    post: operation("Languages", "Create a language", {
      requestBody: jsonBody("LanguageInput"),
      responses: {
        201: successResponse("Language created successfully"),
        409: {
          description: "Language name or code already exists",
        },
      },
    }),
  },

  "/api/languages/{id}": {
    get: operation("Languages", "Get a language by ID", {
      parameters: idParam,
    }),

    put: operation("Languages", "Update a language", {
      parameters: idParam,
      requestBody: jsonBody("LanguageUpdate"),
      responses: {
        409: {
          description: "Language name or code already exists",
        },
      },
    }),
  },

  "/api/languages/{id}/publish": {
    patch: operation("Languages", "Publish a language", {
      parameters: idParam,
    }),
  },

  "/api/languages/{id}/unpublish": {
    patch: operation("Languages", "Unpublish a language", {
      parameters: idParam,
    }),
  },

  // --------------------------------------------
  // MENUS (admin)
  // --------------------------------------------

  "/api/menus": {
    get: operation("Menus", "Get all menus", {
      parameters: [
        {
          name: "languageId",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
          },
          description:
            "Optional language ID. Without it, return the CMS management view.",
        },
      ],
    }),

    post: operation(
      "Menus",
      "Create a menu and its first language translation",
      {
        requestBody: jsonBody("MenuInput"),
        responses: {
          201: successResponse(
            "Menu and its first translation created successfully"
          ),
          409: {
            description:
              "A menu URL already exists for an active translation in this language",
          },
        },
      }
    ),
  },

  "/api/menus/hierarchy": {
    get: operation(
      "Menus",
      "Get nested menu hierarchy for a specific language",
      {
        parameters: [
          {
            name: "languageId",
            in: "query",
            required: true,
            schema: {
              type: "integer",
              minimum: 1,
            },
            description:
              "Language used to select menu translations",
          },
          {
            name: "publishedOnly",
            in: "query",
            required: false,
            schema: {
              type: "boolean",
              default: false,
            },
            description:
              "Set true to return only published menus",
          },
        ],
        responses: {
          200: {
            description: "Menu hierarchy retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/MenuTreeNode",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }
    ),
  },

  "/api/menus/{id}": {
    get: operation("Menus", "Get a menu by ID", {
      parameters: [
        ...idParam,
        {
          name: "languageId",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
          },
          description: "Optional language filter",
        },
      ],
    }),

    patch: operation(
      "Menus",
      "Update common menu properties",
      {
        parameters: idParam,
        requestBody: jsonBody("MenuUpdate"),
      }
    ),

    delete: operation("Menus", "Soft-delete a menu", {
      parameters: idParam,
      responses: {
        200: successResponse("Menu soft-deleted successfully"),
        409: {
          description:
            "Menu has active child menus or active translations and cannot be deleted yet",
        },
      },
    }),
  },

  "/api/menus/{id}/translations": {
    post: operation(
      "Menu Translations",
      "Add a translation to an existing menu",
      {
        parameters: idParam,
        requestBody: jsonBody("MenuTranslationInput"),
        responses: {
          201: successResponse(
            "Menu translation created successfully"
          ),
          409: {
            description:
              "Translation already exists or the URL conflicts with another active translation in this language",
          },
        },
      }
    ),
  },

  "/api/menus/{id}/translations/{menuTranslationId}": {
    patch: operation(
      "Menu Translations",
      "Update a menu translation title or URL",
      {
        parameters: translationParams,
        requestBody: jsonBody("MenuTranslationUpdate"),
        responses: {
          409: {
            description:
              "The URL already exists for another active menu in this language",
          },
        },
      }
    ),
  },

  "/api/menus/{id}/publish": {
    patch: operation("Menus", "Publish a menu", {
      parameters: idParam,
    }),
  },

  "/api/menus/{id}/unpublish": {
    patch: operation("Menus", "Unpublish a menu", {
      parameters: idParam,
    }),
  },

  "/api/menus/{id}/toggle-publish": {
    patch: operation("Menus", "Toggle menu publication status", {
      parameters: idParam,
    }),
  },

  "/api/menus/{id}/restore": {
    patch: operation("Menus", "Restore a soft-deleted menu", {
      parameters: idParam,
    }),
  },

  // --------------------------------------------
  // PAGES (admin)
  // --------------------------------------------

  "/api/pages": {
    get: operation("Pages", "Get all active pages"),

    post: operation(
      "Pages",
      "Create a page for a menu translation",
      {
        requestBody: jsonBody("PageInput"),
        responses: {
          201: successResponse("Page created successfully"),
          409: {
            description:
              "A page already exists for this menu translation",
          },
        },
      }
    ),
  },

  "/api/pages/{id}": {
    get: operation("Pages", "Get a page by ID", {
      parameters: idParam,
    }),

    patch: operation(
      "Pages",
      "Update page content or publication status",
      {
        parameters: idParam,
        requestBody: jsonBody("PageUpdate"),
        responses: {
          409: {
            description:
              "Page cannot be published because its menu or language is unpublished",
          },
        },
      }
    ),
  },

  "/api/pages/{id}/content": {
    post: operation("Pages", "Save or replace page HTML content", {
      parameters: idParam,
      requestBody: jsonBody("ContentInput"),
    }),

    put: operation("Pages", "Update page HTML content", {
      parameters: idParam,
      requestBody: jsonBody("ContentInput"),
    }),
  },

  "/api/pages/{id}/publish": {
    patch: operation("Pages", "Publish a page", {
      parameters: idParam,
      responses: {
        409: {
          description:
            "Page cannot be published because its menu or language is unpublished",
        },
      },
    }),
  },

  "/api/pages/{id}/unpublish": {
    patch: operation("Pages", "Unpublish a page", {
      parameters: idParam,
    }),
  },

  "/api/pages/{id}/toggle-publish": {
    patch: operation("Pages", "Toggle page publication status", {
      parameters: idParam,
      responses: {
        409: {
          description:
            "Page cannot be published because its menu or language is unpublished",
        },
      },
    }),
  },
};

module.exports = swaggerSpec;