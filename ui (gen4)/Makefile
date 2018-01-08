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

# XXX get this automatically...
# 	...also might be good to make this flexible and use these as parameters...
ELECTRON_VERSION=1.7.10


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

.PHONY: all css dev clean cleanall win64e win32e

all: dev

css: $(CSS_FILES)

dev: $(NODE_DIR) css

clean:
	rm -rf $(BUILD_DIR)

cleanall: clean
	rm -rf $(DIST_DIR) $(TARGET_DIR)



# XXX these still depend on the current arch, need to pass architecture to npm...
win64e: $(DIST_DIR)/$(APP_NAME)-win32-x64.zip

win32e: $(DIST_DIR)/$(APP_NAME)-win32-ia32.zip



#**********************************************************************
# build targets...


# build info...
# XXX add build version...
$(APP_DATE):
	date "+%Y%m%d %H%M" > $(APP_DATE)
$(APP_NODE):
	echo "$(NODE_VERSION)" > $(APP_NODE)

$(NODE_DIR):
	npm install


# process LESS files to CSS...
%.css: %.less
	lessc $< > $@


# build app dir...
$(BUILD_DIR)/$(APP_NAME): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	@mkdir -p $@
	cp -r $(PROJECT_FILES) $(JS_FILES) $(CFG_DIR) \
		$(HTML_FILES) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(NODE_DIR) \
		$(BUILD_DIR)/$(APP_NAME)


# pack app.asar
# XXX need to do $(BUILD_DIR)/$(APP_NAME) iff app.asar does not exist...
$(BUILD_DIR)/app.asar: $(BUILD_DIR)/$(APP_NAME)
	cd $(BUILD_DIR) ; \
		asar p "$(APP_NAME)" app.asar


$(TARGET_DIR)/electron-v$(ELECTRON_VERSION)-%.zip:
	@mkdir -p $(@D)
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/v$(ELECTRON_VERSION)/$(@F)" \
		-O $@


$(BUILD_DIR)/$(APP_NAME)-%: $(TARGET_DIR)/electron-v$(ELECTRON_VERSION)-%.zip $(BUILD_DIR)/app.asar
	unzip -u "$<" -d $@ 
	chmod +x $@/*dll $@/*exe
	cp $(BUILD_DIR)/app.asar $@/resources/
	rm -f $@/resources/default_app.asar
	mv $@/electron.exe $@/$(APP_NAME).exe


$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%
	@mkdir -p $(@D)
	cd $(BUILD_DIR) ; \
		zip -r ../$@ $(APP_NAME)-$*



# XXX OSX
# XXX Linux
# XXX android...
# XXX iOS...



#**********************************************************************
