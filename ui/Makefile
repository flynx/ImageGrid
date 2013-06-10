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


# process LESS files to CSS...
%.css: %.less
	lessc $< > $@

# minify js...
%.min.js: %.js
	uglifyjs $< -c -o $@



#**********************************************************************

# get all the .less files to process...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard *.less))

LIB_DIR=lib
EXT_LIB_DIR=ext-lib
NW_PROJECT_FILE=package.json
JS_FILES := $(wildcard *.js)
HTML_FILES := $(wildcard *.html)

# get files to minify...
JS_MIN_FILES := $(patsubst %.js,%.min.js,$(wildcard *.js))

LOGS := *.log

BUILD_DIR=build
WIN_BUILD_DIR=build/Win32
MAC_BUILD_DIR=build/MacOSX
ANDROID_BUILD_DIR=build/Android
IOS_BUILD_DIR=build/iOS

DIST_DIR=dist

# XXX add version
WIN_DIST_ZIP=$(DIST_DIR)/$(APP_NAME)-win32.zip


APP_ZIP=$(BUILD_DIR)/app.zip



#**********************************************************************

all: dev


minify: $(JS_MIN_FILES)



#**********************************************************************
# build dependencies...
# XXX can make auto-create directories???

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)
$(WIN_BUILD_DIR):
	mkdir -p $(WIN_BUILD_DIR)
$(MAC_BUILD_DIR):
	mkdir -p $(MAC_BUILD_DIR)
$(ANDROID_BUILD_DIR):
	mkdir -p $(ANDROID_BUILD_DIR)
$(IOS_BUILD_DIR):
	mkdir -p $(IOS_BUILD_DIR)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)


$(APP_ZIP): $(CSS_FILES) $(BUILD_DIR)
	zip -r $(APP_ZIP) $(NW_PROJECT_FILE) $(JS_FILES) $(CSS_FILES) $(HTML_FILES) $(LIB_DIR) $(EXT_LIB_DIR)



#**********************************************************************
# dev env...

dev: $(CSS_FILES)
	unzip -uj $(wildcard targets/node-webkit/node-webkit-*-win-ia32.zip) -d .
	chmod +x *.{exe,dll}

#dev-targets:
#	mkdir -p targets/node-webkit
#	wget 



#**********************************************************************
# build targets...

# node-webkit win32
win32: $(APP_ZIP) $(WIN_BUILD_DIR)
	unzip -uj $(wildcard targets/node-webkit/node-webkit-*-win-ia32.zip) -d $(WIN_BUILD_DIR)
	cat $(APP_ZIP) >> $(WIN_BUILD_DIR)/nw.exe
	mv $(WIN_BUILD_DIR)/nw.exe $(WIN_BUILD_DIR)/$(APP_NAME).exe
	chmod +x $(WIN_BUILD_DIR)/*.{exe,dll}
win32-dist: win32 $(DIST_DIR)
	zip -rj $(WIN_DIST_ZIP) $(WIN_BUILD_DIR)



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
