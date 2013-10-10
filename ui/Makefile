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

NODE_DIR=node_modules
BUILD_DIR=build
WIN_BUILD_DIR=build/Win32
MAC_BUILD_DIR=build/MacOSX
LINUX_IA32_BUILD_DIR=build/Linux-ia32
LINUX_X64_BUILD_DIR=build/Linux-x64
ANDROID_BUILD_DIR=build/Android
IOS_BUILD_DIR=build/iOS

DIST_DIR=dist

# XXX add version
WIN_DIST_ZIP=$(DIST_DIR)/$(APP_NAME)-win32.zip
MAC_DIST_ZIP=$(DIST_DIR)/$(APP_NAME)-osx.zip


APP_ZIP=$(BUILD_DIR)/app.zip



#**********************************************************************

all: dev


minify: $(JS_MIN_FILES)



#**********************************************************************
# build dependencies...
# XXX can make auto-create directories???

$(NODE_DIR):
	mkdir -p $(NODE_DIR)
$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)
$(WIN_BUILD_DIR):
	mkdir -p $(WIN_BUILD_DIR)
$(MAC_BUILD_DIR):
	mkdir -p $(MAC_BUILD_DIR)
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


$(APP_ZIP): $(CSS_FILES) $(BUILD_DIR) $(NODE_DIR) node-deps
	zip -r $(APP_ZIP) $(NW_PROJECT_FILE) $(JS_FILES) $(CSS_FILES) \
		$(HTML_FILES) $(LIB_DIR) $(EXT_LIB_DIR) $(NODE_DIR)

zip: $(APP_ZIP)



#**********************************************************************
# dev env...

node-deps:
	npm install fs.extra
#	npm install exif

dev: $(CSS_FILES)
	unzip -uj $(wildcard targets/node-webkit/node-webkit-*-win-ia32.zip) -d .
	rm -f nwsnapshot.exe credits.html
	chmod +x *.{exe,dll}

#dev-targets:
#	mkdir -p targets/node-webkit
#	wget 



#**********************************************************************
# build targets...

# node-webkit win32
win32: $(APP_ZIP) $(WIN_BUILD_DIR)
	unzip -uj $(wildcard targets/node-webkit/node-webkit-*-win-ia32.zip) \
		-d $(WIN_BUILD_DIR)
	cat $(APP_ZIP) >> $(WIN_BUILD_DIR)/nw.exe
	mv $(WIN_BUILD_DIR)/nw.exe $(WIN_BUILD_DIR)/$(APP_NAME).exe
	chmod +x $(WIN_BUILD_DIR)/*.{exe,dll}

win32-dist: win32 $(DIST_DIR)
	# XXX include vips...
	# XXX build and include gid, buldcache...
	# XXX include scripts/utils...
	zip -r $(WIN_DIST_ZIP) $(WIN_BUILD_DIR)



# node-webkit mac
# XXX BUG: rebuilding without cleaning will mess up folders...
osx: $(APP_ZIP) $(MAC_BUILD_DIR) Info.plist
	unzip -u $(wildcard targets/node-webkit/node-webkit-*-osx-ia32.zip) \
		-d $(MAC_BUILD_DIR)
	cp $(APP_ZIP) $(MAC_BUILD_DIR)/node-webkit.app/Contents/Resources/app.nw
	# XXX not sure if this is needed...
	chmod +x $(MAC_BUILD_DIR)/node-webkit.app/Contents/Resources/app.nw
	# XXX there is something wrong with the updated Info.plist, need to investigate...
	##cp Info.plist $(MAC_BUILD_DIR)/node-webkit.app/Contents/
	##mv $(MAC_BUILD_DIR)/node-webkit.app $(MAC_BUILD_DIR)/$(APP_NAME).app
	# XXX TODO: add real credits...
	rm -f $(MAC_BUILD_DIR)/nwsnapshot \
		$(MAC_BUILD_DIR)/credits.html


osx-dist: osx $(DIST_DIR)
	zip -r $(MAC_DIST_ZIP) $(MAC_BUILD_DIR)



# node-webkit linux x64
linux-x64: $(APP_ZIP) $(LINUX_X64_BUILD_DIR)
	tar --strip-components 1 \
		-xzf $(wildcard targets/node-webkit/node-webkit-*-linux-x64.tar.gz) \
		-C $(LINUX_X64_BUILD_DIR)
	cat $(APP_ZIP) >> $(LINUX_X64_BUILD_DIR)/nw
	mv $(LINUX_X64_BUILD_DIR)/nw $(LINUX_X64_BUILD_DIR)/$(APP_NAME)
	chmod +x $(LINUX_X64_BUILD_DIR)/*

# XXX
linux-x64-dist: linux-x64 $(DIST_DIR)



# XXX android...
# XXX iOS...


dist: win32-dist osx-dist


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
