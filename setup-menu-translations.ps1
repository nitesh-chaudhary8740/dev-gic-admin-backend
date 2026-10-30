# setup-menu-translations.ps1
# GIC CMS: Menu + MenuTranslation + Page model setup
# Existing affected files are backed up before replacement.

$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$src = Join-Path $root "src"

if (-not (Test-Path (Join-Path $src "models"))) {
    throw "src/models folder nahi mila. Project root se script run karo."
}

# Detect the Sequelize connection file without changing it.
$dbCandidates = @(
    (Join-Path $src "config/database.js"),
    (Join-Path $root "config/database.js")
)
$dbFile = $dbCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $dbFile) {
    throw "Database config nahi mili. Expected src/config/database.js ya config/database.js."
}

# Model files are inside src/models, so calculate the correct relative path.
$dbRequire = if ($dbFile.StartsWith($src, [StringComparison]::OrdinalIgnoreCase)) {
    "../config/database"
} else {
    "../../config/database"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "backup-menu-translations-$stamp"

$files = @{}

$files["src/models/Menu.js"] = @'
const { DataTypes } = require("sequelize");
const sequelize = require("__DB_REQUIRE__");

const Menu = sequelize.define("Menu", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "menus", key: "id" }
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: "menus",
  timestamps: true
});

module.exports = Menu;
'@

$files["src/models/MenuTranslation.js"] = @'
const { DataTypes } = require("sequelize");
const sequelize = require("__DB_REQUIRE__");

const MenuTranslation = sequelize.define("MenuTranslation", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  menuId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "menus", key: "id" }
  },
  languageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "languages", key: "id" }
  },
  menuTitle: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  menuURL: {
    type: DataTypes.STRING(500),
    allowNull: false
  }
}, {
  tableName: "menu_translations",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["menuId", "languageId"]
    },
    {
      unique: true,
      fields: ["languageId", "menuURL"]
    }
  ]
});

module.exports = MenuTranslation;
'@

$files["src/models/Page.js"] = @'
const { DataTypes } = require("sequelize");
const sequelize = require("__DB_REQUIRE__");

const Page = sequelize.define("Page", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  menuTranslationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: "menu_translations", key: "id" }
  },
  content: {
    type: DataTypes.TEXT("long"),
    allowNull: true
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: "pages",
  timestamps: true
});

module.exports = Page;
'@

$files["src/models/Language.js"] = @'
const { DataTypes } = require("sequelize");
const sequelize = require("__DB_REQUIRE__");

const Language = sequelize.define("Language", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: "languages",
  timestamps: true
});

module.exports = Language;
'@

$files["src/models/index.js"] = @'
const sequelize = require("__DB_REQUIRE__");

const Menu = require("./Menu");
const MenuTranslation = require("./MenuTranslation");
const Page = require("./Page");
const Language = require("./Language");

// A menu can have a parent and multiple child menus.
Menu.belongsTo(Menu, {
  as: "parent",
  foreignKey: "parentId"
});
Menu.hasMany(Menu, {
  as: "children",
  foreignKey: "parentId"
});

// Each logical menu has one translation per language.
Menu.hasMany(MenuTranslation, {
  as: "translations",
  foreignKey: "menuId"
});
MenuTranslation.belongsTo(Menu, {
  as: "menu",
  foreignKey: "menuId"
});

Language.hasMany(MenuTranslation, {
  as: "translations",
  foreignKey: "languageId"
});
MenuTranslation.belongsTo(Language, {
  as: "language",
  foreignKey: "languageId"
});

// Each translated menu can have one page.
MenuTranslation.hasOne(Page, {
  as: "page",
  foreignKey: "menuTranslationId"
});
Page.belongsTo(MenuTranslation, {
  as: "menuTranslation",
  foreignKey: "menuTranslationId"
});

module.exports = {
  sequelize,
  Menu,
  MenuTranslation,
  Page,
  Language
};
'@

$files["src/services/menuTranslationService.js"] = @'
const {
  Menu,
  MenuTranslation,
  Language,
  Page
} = require("../models");

async function createTranslation(data) {
  const menu = await Menu.findOne({
    where: { id: data.menuId, isDeleted: false }
  });
  if (!menu) throw Object.assign(new Error("Menu not found"), { status: 404 });

  const language = await Language.findByPk(data.languageId);
  if (!language) {
    throw Object.assign(new Error("Language not found"), { status: 404 });
  }

  return MenuTranslation.create({
    menuId: data.menuId,
    languageId: data.languageId,
    menuTitle: data.menuTitle,
    menuURL: data.menuURL
  });
}

async function getAllTranslations(filters = {}) {
  const where = {};
  if (filters.menuId) where.menuId = filters.menuId;
  if (filters.languageId) where.languageId = filters.languageId;

  return MenuTranslation.findAll({
    where,
    include: [
      { model: Menu, as: "menu" },
      { model: Language, as: "language" }
    ],
    order: [["id", "ASC"]]
  });
}

async function getTranslationById(id) {
  const record = await MenuTranslation.findByPk(id, {
    include: [
      { model: Menu, as: "menu" },
      { model: Language, as: "language" },
      { model: Page, as: "page" }
    ]
  });

  if (!record) {
    throw Object.assign(new Error("Menu translation not found"), { status: 404 });
  }
  return record;
}

async function updateTranslation(id, data) {
  const record = await MenuTranslation.findByPk(id);
  if (!record) {
    throw Object.assign(new Error("Menu translation not found"), { status: 404 });
  }

  const allowed = ["menuTitle", "menuURL", "menuId", "languageId"];
  const changes = {};
  for (const key of allowed) {
    if (data[key] !== undefined) changes[key] = data[key];
  }

  if (changes.menuId !== undefined) {
    const menu = await Menu.findOne({
      where: { id: changes.menuId, isDeleted: false }
    });
    if (!menu) throw Object.assign(new Error("Menu not found"), { status: 404 });
  }

  if (changes.languageId !== undefined) {
    const language = await Language.findByPk(changes.languageId);
    if (!language) {
      throw Object.assign(new Error("Language not found"), { status: 404 });
    }
  }

  await record.update(changes);
  return getTranslationById(id);
}

async function deleteTranslation(id) {
  const record = await MenuTranslation.findByPk(id);
  if (!record) {
    throw Object.assign(new Error("Menu translation not found"), { status: 404 });
  }

  // Prevent deleting a translation that still owns a page.
  const page = await Page.findOne({ where: { menuTranslationId: id } });
  if (page) {
    throw Object.assign(
      new Error("Cannot delete this translation while its page exists"),
      { status: 409 }
    );
  }

  await record.destroy();
  return { id: Number(id), deleted: true };
}

async function getMenuHierarchy(languageId) {
  if (!languageId) {
    throw Object.assign(new Error("languageId query parameter is required"), {
      status: 400
    });
  }

  const menus = await Menu.findAll({
    where: { isDeleted: false },
    include: [{
      model: MenuTranslation,
      as: "translations",
      where: { languageId: Number(languageId) },
      required: true
    }],
    order: [["id", "ASC"]]
  });

  const nodes = new Map();

  for (const menu of menus) {
    const item = menu.toJSON();
    const translation = item.translations?.[0];
    if (!translation) continue;

    nodes.set(item.id, {
      id: item.id,
      parentId: item.parentId,
      menuTranslationId: translation.id,
      menuTitle: translation.menuTitle,
      menuURL: translation.menuURL,
      children: []
    });
  }

  const roots = [];
  for (const node of nodes.values()) {
    if (node.parentId !== null && nodes.has(node.parentId)) {
      nodes.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

module.exports = {
  createTranslation,
  getAllTranslations,
  getTranslationById,
  updateTranslation,
  deleteTranslation,
  getMenuHierarchy
};
'@

$files["src/controllers/menuTranslationController.js"] = @'
const service = require("../services/menuTranslationService");

function handleError(res, error) {
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      success: false,
      message: "A translation already exists for this menu/language or URL."
    });
  }

  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : error.message
  });
}

function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

exports.create = async (req, res) => {
  try {
    const { menuId, languageId, menuTitle, menuURL } = req.body;
    if (!positiveInt(menuId) || !positiveInt(languageId) ||
        typeof menuTitle !== "string" || !menuTitle.trim() ||
        typeof menuURL !== "string" || !menuURL.trim()) {
      return res.status(400).json({
        success: false,
        message: "menuId, languageId, menuTitle and menuURL are required."
      });
    }

    const data = await service.createTranslation({
      menuId: Number(menuId),
      languageId: Number(languageId),
      menuTitle: menuTitle.trim(),
      menuURL: menuURL.trim()
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAll = async (req, res) => {
  try {
    const data = await service.getAllTranslations({
      menuId: req.query.menuId,
      languageId: req.query.languageId
    });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getById = async (req, res) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = await service.getTranslationById(id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.update = async (req, res) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id." });

    const { menuTitle, menuURL, menuId, languageId } = req.body;
    if (menuTitle !== undefined &&
        (typeof menuTitle !== "string" || !menuTitle.trim())) {
      return res.status(400).json({ success: false, message: "menuTitle must not be empty." });
    }
    if (menuURL !== undefined &&
        (typeof menuURL !== "string" || !menuURL.trim())) {
      return res.status(400).json({ success: false, message: "menuURL must not be empty." });
    }
    if (menuId !== undefined && !positiveInt(menuId)) {
      return res.status(400).json({ success: false, message: "Invalid menuId." });
    }
    if (languageId !== undefined && !positiveInt(languageId)) {
      return res.status(400).json({ success: false, message: "Invalid languageId." });
    }

    const data = await service.updateTranslation(id, {
      ...(menuTitle !== undefined ? { menuTitle: menuTitle.trim() } : {}),
      ...(menuURL !== undefined ? { menuURL: menuURL.trim() } : {}),
      ...(menuId !== undefined ? { menuId: Number(menuId) } : {}),
      ...(languageId !== undefined ? { languageId: Number(languageId) } : {})
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.remove = async (req, res) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = await service.deleteTranslation(id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.hierarchy = async (req, res) => {
  try {
    const languageId = positiveInt(req.query.languageId);
    if (!languageId) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid languageId query parameter."
      });
    }
    const data = await service.getMenuHierarchy(languageId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};
'@

$files["src/routes/menuTranslationRoutes.js"] = @'
const express = require("express");
const controller = require("../controllers/menuTranslationController");

const router = express.Router();

router.get("/hierarchy", controller.hierarchy);
router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
'@

# Prepare output paths and back up any files that will be replaced.
foreach ($relativePath in $files.Keys) {
    $fullPath = Join-Path $root $relativePath
    $parent = Split-Path $fullPath -Parent

    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    if (Test-Path $fullPath) {
        $backupPath = Join-Path $backupDir $relativePath
        $backupParent = Split-Path $backupPath -Parent
        New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
        Copy-Item $fullPath $backupPath -Force
    }
}

# Do not overwrite an existing Language model: keep its original fields.
# If Language.js exists, remove its generated replacement from this run.
if (Test-Path (Join-Path $src "models/Language.js")) {
    $files.Remove("src/models/Language.js")
}

foreach ($relativePath in $files.Keys) {
    $fullPath = Join-Path $root $relativePath
    $content = $files[$relativePath].Replace("__DB_REQUIRE__", $dbRequire)
    Set-Content -Path $fullPath -Value $content -Encoding UTF8
    Write-Host "Generated: $relativePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setup files generated." -ForegroundColor Cyan
if (Test-Path $backupDir) {
    Write-Host "Backups saved to: $backupDir" -ForegroundColor Yellow
}
Write-Host "Database schema has NOT been changed." -ForegroundColor Yellow
Write-Host "Review models/index.js and your existing Language model before starting the API."
