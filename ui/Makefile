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


all: css


css: $(CSS_FILES)

minify: $(JS_MIN_FILES)


# build dependencies...

build_dir:
	mkdir -p $(BUILD_DIR)

app_zip: css build_dir
	zip -r $(BUILD_DIR)/app.zip $(NW_PROJECT_FILE) $(JS_FILES) $(CSS_FILES) $(HTML_FILES) $(LIB_DIR) $(EXT_LIB_DIR)


# dev env...

dev: css
	unzip -uj $(wildcard targets/node-webkit/node-webkit-*-win-ia32.zip) -d .
	chmod +x *.{exe,dll}


# build targets...

# node-webkit win32
win32: app_zip build_dir
	unzip -uj $(wildcard targets/node-webkit/node-webkit-*-win-ia32.zip) -d $(BUILD_DIR)
	cat $(BUILD_DIR)/app.zip >> $(BUILD_DIR)/nw.exe
	mv $(BUILD_DIR)/nw.exe $(BUILD_DIR)/$(APP_NAME).exe
	chmod +x $(BUILD_DIR)/*.{exe,dll}
	rm -f $(BUILD_DIR)/app.zip

mac: css minify

phonegap-remote: css minify



# cleanup...

clean-dev:
	rm -rf *.exe *.dll *.pak

clean-build:
	rm -rf $(BUILD_DIR)

clean: clean-build
	rm -f $(CSS_FILES) $(JS_MIN_FILES) $(LOGS)

clean-all: clean clean-dev


