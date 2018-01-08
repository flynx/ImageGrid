#**********************************************************************
# TODO: build to a BUILD_DIR...
# TODO: build all target platforms...
#	- Windows (AppJS)
#	- MacOSX (AppJS)
#	- Windows8 (native?) XXX
#	- PhoneGap-remote
#	  push and api call to fetch and rebuild
#	- PhoneGap-local XXX
#

APP_NAME=ImageGrid.Viewer


ELECTRON_DOWNOAD_URL=https://github.com/electron/electron/releases/download


# XXX get these automatically...
# 	...also might be good to make this flexible and use these as parameters...
TARGET_OS=win32
ELECTRON_VERSION=$(strip $(shell electron -v))
NODE_VERSION=`node --version`



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

# get all the .less files to process...
#LESS_FILES := $(shell find . -type f -name '*.less')
CSS_FILES := $(patsubst %.less,%.css,$(wildcard css/*.less))
PROJECT_FILES=package.json
JS_FILES := $(wildcard *.js)
HTML_FILES := $(wildcard *.html)

APP_DATE=$(BUILD_DIR)/DATE
APP_NODE=$(BUILD_DIR)/NODE



#**********************************************************************

all: dev

.PHONY: all css dev clean cleanall dist \
	electron-dist-x64 electron-dist-ia32



css: $(CSS_FILES)

dev: $(NODE_DIR) css

clean:
	rm -rf $(BUILD_DIR)

# XXX for some reason this is called on make win64e...
cleanall: clean
	rm -rf $(DIST_DIR) $(TARGET_DIR)



# XXX autodetect arch/os...
# XXX add support for nw...
electron-dist-x64: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-x64.zip

electron-dist-ia32: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-ia32.zip



dist: electron-dist-x64



#**********************************************************************
# build targets...


# build info...
# XXX add build version...
$(APP_DATE):
	date "+%Y%m%d %H%M" > $(APP_DATE)
$(APP_NODE):
	echo "$(NODE_VERSION)" > $(APP_NODE)


# XXX need to make this arch/os specific for cross compiling...
$(NODE_DIR):
	npm install


# process LESS files to CSS...
%.css: %.less
	lessc $< > $@


# build app dir...
# XXX need to make this arch/os specific...
# XXX make junction to $(NODE_DIR) -- does not work with asar
# XXX this is electron-specific...
$(BUILD_DIR)/$(APP_NAME): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	@mkdir -p $@
	cp -rlu $(PROJECT_FILES) $(JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		"$(BUILD_DIR)/$(APP_NAME)"
	cp -rlu $(NODE_DIR) \
		"$(BUILD_DIR)/$(APP_NAME)"
	#ln -s $(NODE_DIR) "$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)"
	#cmd /c mklink /j "$(BUILD_DIR)\$(APP_NAME)\$(NODE_DIR)" \
	#	$(NODE_DIR) 
	touch "$@"


# pack app.asar
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


# XXX nwjs...


# build the app dir...
# XXX this is electron-specific...
.PRECIOUS: $(BUILD_DIR)/$(APP_NAME)-%
$(BUILD_DIR)/$(APP_NAME)-%: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip $(BUILD_DIR)/app.asar
	unzip -u "$<" -d "$@" 
	chmod +x "$@/"*dll "$@/"*exe
	cp "$(BUILD_DIR)/app.asar" "$@/resources/"
	rm -f "$@/resources/default_app.asar"
	mv "$@/electron.exe" "$@/$(APP_NAME).exe"
	touch "$@"


# package the app dir...
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%
	@mkdir -p "$(@D)"
	cd "$(BUILD_DIR)" ; \
		zip -r "../$@" "$(APP_NAME)-$*"



# XXX OSX
# XXX Linux
# XXX android...
# XXX iOS...



#**********************************************************************
