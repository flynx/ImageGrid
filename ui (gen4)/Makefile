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

NODE_VERSION=v5.10.0


# process LESS files to CSS...
%.css: %.less
	lessc $< > $@

# minify js...
%.min.js: %.js
	uglifyjs $< -c -o $@



#**********************************************************************

# get all the .less files to process...
#LESS_FILES := $(shell find . -type f -name '*.less')
#CSS_FILES := $(patsubst %.less,%.css,$(LESS_FILES))
CSS_FILES := $(patsubst %.less,%.css,$(wildcard css/*.less))

LIB_DIR=lib
EXT_LIB_DIR=ext-lib
CSS_DIR=css
FEATURES_DIR=features
NW_PROJECT_FILE=package.json
JS_FILES := $(wildcard *.js)
HTML_FILES := $(wildcard *.html)
CHROME_APP_KEY=chrome-app.pem


# get files to minify...
JS_MIN_FILES := $(patsubst %.js,%.min.js,$(wildcard *.js))

LOGS := *.log

NODE_DIR=node_modules
BUILD_DIR=build
CHROME_APP_BUILD_DIR=build/Chrome-App/ImageGrid.Viewer
WIN_BUILD_DIR=build/Win64
MAC_BUILD_DIR=build/MacOSX
MAC_10_6_BUILD_DIR=build/MacOSX-10.6
LINUX_IA32_BUILD_DIR=build/Linux-ia32
LINUX_X64_BUILD_DIR=build/Linux-x64
ANDROID_BUILD_DIR=build/Android
IOS_BUILD_DIR=build/iOS

DIST_DIR=./dist

# XXX add version
WIN_DIST_ZIP=$(DIST_DIR)/$(APP_NAME)-win64.zip
MAC_DIST_ZIP=$(DIST_DIR)/$(APP_NAME)-osx.zip
MAC_10_6_DIST_ZIP=$(DIST_DIR)/$(APP_NAME)-osx10.6.zip


APP_ZIP=$(BUILD_DIR)/package.nw



#**********************************************************************

all: dev


minify: $(JS_MIN_FILES)



#**********************************************************************
# build dependencies...
# XXX can make auto-create directories???

$(NODE_DIR): node-deps

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)
$(CHROME_APP_BUILD_DIR):
	mkdir -p $(CHROME_APP_BUILD_DIR)
$(WIN_BUILD_DIR):
	mkdir -p $(WIN_BUILD_DIR)
$(MAC_BUILD_DIR):
	mkdir -p $(MAC_BUILD_DIR)
$(MAC_10_6_BUILD_DIR):
	mkdir -p $(MAC_10_6_BUILD_DIR)
$(LINUX_IA32_BUILD_DIR):
	mkdir -p $(LINUX_IA32_BUILD_DIR)
$(LINUX_X64_BUILD_DIR):
	mkdir -p $(LINUX_X64_BUILD_DIR)
$(ANDROID_BUILD_DIR):
	mkdir -p $(ANDROID_BUILD_DIR)
$(IOS_BUILD_DIR):
	mkdir -p $(IOS_BUILD_DIR)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)


$(APP_ZIP): $(CSS_FILES) $(BUILD_DIR) $(NODE_DIR) $(NW_PROJECT_FILE) \
	$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	zip -r $(APP_ZIP) $(NW_PROJECT_FILE) $(JS_FILES) $(CSS_FILES) \
		$(HTML_FILES) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(CSS_DIR) \
		$(NODE_DIR)/app-module-path

zip: $(APP_ZIP)



#**********************************************************************
# dev env...

# see: package.json for a list...
node-deps:
	npm install

sharp: node-deps
	cd node_modules/sharp/
	node-gyp --target=$(NODE_VERSION) rebuild

css: $(CSS_FILES)

dev: css
	#unzip -uj $(wildcard targets/nwjs/nwjs-*-win-ia32.zip) -d .
	#rm -f nwsnapshot.exe credits.html
	#chmod +x *.{exe,dll}

#dev-targets:
#	mkdir -p targets/nwjs
#	wget 



#**********************************************************************
# build targets...
# XXX most of the code here is duplicated, find a way to reuse sections...

chrome-app: $(APP_ZIP) $(CHROME_APP_BUILD_DIR)
	unzip -u $(APP_ZIP) -d $(CHROME_APP_BUILD_DIR)
	cp manifest.json $(CHROME_APP_BUILD_DIR)
	cp -R images $(CHROME_APP_BUILD_DIR)
	rm -rf $(CHROME_APP_BUILD_DIR)/node_modules/
	# this needs to be OS independent...
	chrome --pack-extension=$(CHROME_APP_BUILD_DIR) --pack-extension-key=$(CHROME_APP_KEY)


# nwjs win64
# XXX include exiftool...
# XXX include scripts/utils???
win64: $(APP_ZIP) $(WIN_BUILD_DIR)
	unzip -u targets/nwjs/nwjs-*-win-x64.zip \
		-d $(WIN_BUILD_DIR)
	mv $(WIN_BUILD_DIR)/nwjs*win-x64/* $(WIN_BUILD_DIR)/	
	rm -rf $(WIN_BUILD_DIR)/nwjs*/	
	cat $(APP_ZIP) >> $(WIN_BUILD_DIR)/nw.exe
	mv $(WIN_BUILD_DIR)/nw.exe $(WIN_BUILD_DIR)/$(APP_NAME).exe
	chmod +x $(WIN_BUILD_DIR)/*.{exe,dll}
	cp -vR \
		$(NODE_DIR) $(WIN_BUILD_DIR)
	# XXX is this correct???
	cp -vR "`which exiftool`" $(WIN_BUILD_DIR)
	# cleanup nwjs-sdk...
	rm -f $(WIN_BUILD_DIR)/nwsnapshot.exe \
		$(WIN_BUILD_DIR)/payload.exe \
		$(WIN_BUILD_DIR)/chromedriver.exe \
		$(WIN_BUILD_DIR)/nwjc.exe \
		$(WIN_BUILD_DIR)/credits.html

win64-dist: win64 $(DIST_DIR)
	zip -r $(WIN_DIST_ZIP) $(WIN_BUILD_DIR)


# XXX OSX
# XXX Linux
# XXX android...
# XXX iOS...


all: win64

dist: win64-dist


#**********************************************************************
# cleanup...

clean-dev:
	rm -rf *.exe *.dll *.pak

clean-build:
	rm -rf $(BUILD_DIR)

clean: clean-build
	rm -f $(CSS_FILES) $(JS_MIN_FILES) $(LOGS)

clean-all: clean clean-dev



#**********************************************************************
