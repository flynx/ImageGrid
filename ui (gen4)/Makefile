#**********************************************************************
#
# ImageGrid.Viewer Makefile...
#
#
# Make dependencies that need to be installed:
# 	- nodejs / npm
# 	- wget
# 	- zip / unzip
# 	- Windows
# 		- MSVS -- to build node modules (sharp)
# 		- WiX
#	- Linux
#	- macOS
#	- iOS
# 	- Android
# 	- web
#
#
# ToDo:
# 	- add a cli-only build
# 	- installers:
# 		- msi
# 		- deb
# 	- cross-compiling support...
#
#
#
#**********************************************************************
# variables...

APP_NAME = ImageGrid.Viewer


# Electron stuff...
# XXX Linux does not let an app run if some of the libs it is linked 
# 	against are missing, this can happen if we try to run electron
# 	on a non-GUI box...
# 	...love the "statically" linked "dynamic" libs...
ELECTRON_VERSION := $(strip $(shell electron -v))
ELECTRON_VERSION ?= v1.8.1
ELECTRON_DOWNOAD_URL = https://github.com/electron/electron/releases/download


# OS-specific stuff...
ifeq ($(OS),Windows_NT)
	EXT = .exe
	DLLs = "$@/"*dll
	TARGET_OS = win32

else
	ifeq ($(shell uname -s),Linux)
		TARGET_OS = linux
	endif
	ifeq ($(shell uname -s),Darwin)
		TARGET_OS = darwin
	endif
endif


#----------------------------------------------------------------------
# Built-in make stuff...

RM += -f



#**********************************************************************

TARGET_DIR=targets
NODE_DIR=node_modules
BUILD_DIR=build
DIST_DIR=dist

LIB_DIR=lib
EXT_LIB_DIR=ext-lib
CSS_DIR=css
CFG_DIR=cfg
DOMAIN_DIR=imagegrid
FEATURES_DIR=features
WORKERS_DIR=workers
IMAGES_DIR=images

PROJECT_FILES = package.json
# get all the .less files to process...
#LESS_FILES := $(shell find . -type f -name '*.less')
CSS_FILES := $(patsubst %.less,%.css,$(wildcard css/*.less))
JS_FILES := $(wildcard *.js)
HTML_FILES := $(wildcard *.html)

APP_DATE=$(BUILD_DIR)/DATE



#**********************************************************************
# User targets...

all: dev

.PHONY: all css dev clean cleanall dist \
	electron-dist-x64 electron-dist-ia32


css: $(CSS_FILES)

dev: $(NODE_DIR) css

clean:
	$(RM) $(BUILD_DIR)

# XXX for some reason this is called on make win64e...
cleanall: clean
	$(RM) $(DIST_DIR) $(TARGET_DIR)


electron-dist-x64: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-x64.zip
electron-inst-x64: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-x64.msi

electron-dist-ia32: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-ia32.zip
electron-inst-ia32: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-ia32.msi


dist: electron-dist-x64



#**********************************************************************
# build rules...


# build date...
# XXX add build version...
$(APP_DATE): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	@mkdir -p "$(@D)"
	date "+%Y%m%d %H%M" > $(APP_DATE)


# XXX need to make this arch/os specific for cross compiling...
$(NODE_DIR):
	npm install


# process LESS files to CSS...
%.css: %.less
	lessc $< > $@


# build app dir...
# XXX need to make this arch/os specific (see: $(NODE_DIR) rule)...
# XXX make junction to $(NODE_DIR) -- does not work with asar
$(BUILD_DIR)/$(APP_NAME): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES) \
		$(APP_DATE)
	@mkdir -p $@
	cp -rlu $(PROJECT_FILES) $(JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(APP_DATE) \
		"$(BUILD_DIR)/$(APP_NAME)"
	cp -rlu $(NODE_DIR) \
		"$(BUILD_DIR)/$(APP_NAME)"
	#ln -s $(NODE_DIR) "$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)"
	#cmd /c mklink /j "$(BUILD_DIR)\$(APP_NAME)\$(NODE_DIR)" \
	#	$(NODE_DIR) 
	touch "$@"


# pack app.asar (electron-specific)...
# XXX need to do $(BUILD_DIR)/$(APP_NAME) iff app.asar does not exist...
$(BUILD_DIR)/app.asar: $(BUILD_DIR)/$(APP_NAME)
	cd $(BUILD_DIR) ; \
		asar p "$(APP_NAME)" app.asar


# get the electron binary...
# XXX for some odd reason this is deleted adter extraction...
.PRECIOUS: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip
$(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip:
	@mkdir -p $(@D)
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/$(ELECTRON_VERSION)/$(@F)" \
		-O "$@"


# build the app dir...
# XXX this is electron-specific...
.PRECIOUS: $(BUILD_DIR)/$(APP_NAME)-%
$(BUILD_DIR)/$(APP_NAME)-%: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip \
		$(BUILD_DIR)/app.asar $(APP_DATE)
	unzip -u "$<" -d "$@" 
	cp "$(BUILD_DIR)/app.asar" "$@/resources/"
	cp -f "$(APP_DATE)" "$@/"
	$(RM) "$@/resources/default_app.asar"
	mv "$@/electron$(EXT)" "$@/$(APP_NAME)$(EXT)"
	chmod +x "$@/$(APP_NAME)$(EXT)" $(DLLs)
	touch "$@"


# package the app dir...
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%
	@mkdir -p "$(@D)"
	cd "$(BUILD_DIR)" ; \
		zip -r "../$@" "$(APP_NAME)-$*"


# XXX nwjs... (???)


# installer (WiX)...
# XXX add to path...

# harvest directory tree...
%.wxs:
	heat dir $* -gg -o $<
	
# XXX provide -arch x64/ia32...
%.wixobj: %.wsx
	candle -o $@ $<

%.msi: %.wixobj
	light -o $@ $<

# installer (WiX)...
$(DIST_DIR)/$(APP_NAME)-%.msi: $(BUILD_DIR)/$(APP_NAME)-% $(BUILD_DIR)/$(APP_NAME).wxs
	@mkdir -p "$(@D)"


# XXX OSX
# XXX android...
# XXX iOS...



#**********************************************************************
