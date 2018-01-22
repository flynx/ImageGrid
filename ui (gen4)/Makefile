#**********************************************************************
#
# ImageGrid.Viewer Makefile...
#
#
# Make dependencies that need to be installed (make check):
# 	- General
#	 	- git
# 		- nodejs / npm 
# 			also nodejs-legacy seems to be required by some code...
# 		- npm i -g electron electron-rebuild asar less
# 		- wget
# 		- zip / unzip / zipnote
# 			if zipnote fails this is likely due to a bug in 
# 			v3.0, to fix this by either upgrading to 3.1 or 
# 			a patched version of 3.0...
# 			for more info and patch see: 
# 				https://goo.gl/csQmQo
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
# Build targets:
# 	check		- check dependencies
# 	dev		- build the development environment
#
# 	app-dir-full	- build full app dir
# 	app-dir-minimal - build minimal app dir (used for web)
# 			  NOTE: these are runtime neutral
#
# 	web		- build a version runnable in browser
#
# 	electron-dist	- electron distribution (default)
# 	electron-unpacked
# 			- build an unpacked electron app dir
# 			  NOTE: this builds to a different directory than
# 			  	app-dir-*
# 	electron-insr	- build electron app installer (XXX not implemented)
#
# 	cleanall	- clean up fully.
# 			  removes: ./targets/, ./build/, ./dist/
#
#
# Variables to control the build:
# 	APP_NAME	- Application name
# 	APP_BIN		- App binary name (ignored for MacOS)
#
# 	ARCH		- target achitecture (ia32, x86)
# 	TARGET_OS	- target OS (win32, linux, darwin)
#
# 	ELECTRON_DOWNOAD_URL
# 			- URL to download electron pinary
# 	ELECTRON_DIST	- electron distribution file name pattern
# 	BUILD_MODE	- can be "repack" or "in-place" (default)
#
# NOTE: when setting variables avoid using spaces and other characters 
# 	make can get fussy about...
# NOTE: to do a repack build call:
# 		(export BUILD_MODE=repack && make)
# NOTE: in most cases we do not add a "/" to target dirs to destinguish 
# 	them from target files except for one case:
#		$(BUILD_DIR)/$(APP_NAME)-%/
#	this will help make destinguish it from things like:
#		$(DIST_DIR)/$(APP_NAME)-%.zip
# NOTE: cross compilation is at this time not supported, if you try it 
# 	and it works then 1) you got very lucky and 2) tell me about it =)
# 	...at least the node native packages (sharp) will likely either 
# 	fail or	win get compiled to the wrong arch and not be used and
# 	for the most part ImageGrid is cleaver about and will simply not
# 	load the depending features...
#
#
#
#----------------------------------------------------------------------
#
# ToDo:
# 	- sync version numbers between:
# 		- git tags (currently not used)
# 		- package.json
# 			can't use only this because it can't be imported 
# 			in browser directly...
# 			...do we actually need the file:// version working?
# 		- version.js
# 	- app icons...
# 	- add a cli-only build
# 	- installers:
# 		- msi (wix)
# 		- deb
# 		- rpm
# 	- cross-compiling support (???)
# 	- upstream clean build: git clone -> make dist
# 	- nwjs???
#
#
# Links:
# 	WiX example...
# 		https://helgeklein.com/blog/2014/09/real-world-example-wix-msi-application-installer/
# 	npm modules to abstract WiX...
# 		https://www.npmjs.com/package/electron-wix-msi
# 		https://www.npmjs.com/package/electron-builder
#
#
#
#**********************************************************************
.SECONDEXPANSION:
# variables...


APP_NAME ?= ImageGrid.Viewer


VERSION_FALLBACK ?= 4.0.0a
# NOTE: we are not using './ig --version 2> /dev/null' because it will 
# 	not work before we do 'npm install'...
VERSION := $(strip $(shell \
	node version.js \
		|| echo $(VERSION_FALLBACK)))
DATE := $(strip $(shell date "+%Y%m%d%H%M"))
COMMIT := $(strip $(shell git rev-parse HEAD))


# Electron stuff...
#
# NOTE: Linux does not let an app run if some of the libs it is dynamically 
# 	linked against are missing, this can happen if we try to run electron
# 	on a non-GUI box (i.e. no gtk)...
# 	...love the "statically" linked "dynamic" libs...
ELECTRON_VERSION_FALLBACK ?= v1.8.1
ELECTRON_VERSION := $(strip $(shell \
	electron -v 2> /dev/null \
		|| echo $(ELECTRON_VERSION_FALLBACK)))
ELECTRON_DOWNOAD_URL ?= https://github.com/electron/electron/releases/download
ELECTRON_DIST ?= electron-$(ELECTRON_VERSION)-$(TARGET_OS)-$(ARCH).zip


BUILD_MODE ?= in-place


# OS-specific stuff...
ifeq ($(OS),Windows_NT)
	# NOTE: this is electron naming convention...
	TARGET_OS ?= win32

	# set arch...
	ifeq ($(PROCESSOR_ARCHITEW6432),AMD64)
		ARCH ?= x64
	else
		ifeq ($(PROCESSOR_ARCHITECTURE),AMD64)
			ARCH ?= x64
		endif
		ifeq ($(PROCESSOR_ARCHITECTURE),x86)
			ARCH ?= ia32
		endif
	endif

else
	ifeq ($(shell uname -s),Linux)
		TARGET_OS ?= linux
	endif
	ifeq ($(shell uname -s),Darwin)
		TARGET_OS ?= darwin
	endif

	# set arch...
	ifeq ($(shell uname -m),x86_64)
		ARCH ?= x64
	endif
	ifneq ($(filter %86,$(shell uname -p)),)
		ARCH ?= ia32
	endif
endif


# setup path and file naming stuff...
ifeq ($(TARGET_OS),win32)
	APP_BIN ?= ig
	ELECTRON_BIN = electron
	ASAR_PATH = resources
	EXT = .exe
	DLLs = "$@/"*dll
endif
ifeq ($(TARGET_OS),linux)
	APP_BIN ?= ig
	ELECTRON_BIN = electron
	ASAR_PATH = resources
endif
ifeq ($(TARGET_OS),darwin)
	APP_BIN ?= $(APP_NAME)
	ELECTRON_BIN = Electron
	ASAR_PATH = Electron.app/Contents/Resources
	EXT = .app
endif



#----------------------------------------------------------------------
# Built-in make stuff...

# NOTE: some of the targets are directories so this will enable GNUMake's
# 	automatic cleanup to work.
# 	...not sure if this is the right way to go...
RM += -r

MD = @mkdir -p


#**********************************************************************
# Paths and lists...

TARGET_DIR = targets
DIST_DIR = dist
# NOTE: this can not contain spaces...
BUILD_DIR = build

NODE_DIR = node_modules
LIB_DIR = lib
EXT_LIB_DIR = ext-lib
CSS_DIR = css
CFG_DIR = cfg
DOMAIN_DIR = imagegrid
FEATURES_DIR = features
WORKERS_DIR = workers
IMAGES_DIR = images

BUILD_INFO = $(BUILD_DIR)/INFO
PROJECT_FILES = package.json
# get all .css build targets, in addition, get all the .less files and 
# replace .less with .css making them build targets...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard css/*.less))
HTML_FILES := $(wildcard *.html)
JS_FILES := $(wildcard *.js)

# XXX do we actually use preact???
INCLUDE_NODE_MODULES = ig-object ig-actions ig-features preact

# dependencies to check...
# XXX might be a good idea to split these to sections and check only what
# 	is needed...
# 	...like: base, electron, wix, ...
DEPENDENCIES = node npm wget zip unzip zipnote git \
	lessc electron electron-rebuild asar
# WiX dependencies, windows only...
#DEPENDENCIES += heat candle light



#**********************************************************************
# User targets...

.PHONY: all
all: check dev dist deploy


.PHONY: css
css: $(CSS_FILES)


.PHONY: dev
dev: $(NODE_DIR) css


.PHONY: clean
clean:
	$(RM) $(BUILD_DIR)


.PHONY: cleanall
cleanall: clean
	$(RM) $(DIST_DIR) $(TARGET_DIR) $(NODE_DIR)


.PHONY: electron-dist
electron-dist: VERSION := $(VERSION)-el
electron-dist: DIST := $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).zip
electron-dist: $(DIST)

# add a time stamp to version...
.PHONY: test-electron-dist
test-electron-dist: VERSION := $(VERSION)-$(DATE)-el
test-electron-dist: DIST := $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).zip
test-electron-dist: $$(DIST)
#test-electron-dist: $(DIST_DIR)/$(APP_NAME)-$$(VERSION)-$(TARGET_OS)-$(ARCH).zip


# NOTE: the "/" at the end here is significant...
.PHONY: electron-unpacked
electron-unpacked: VERSION := $(VERSION)-el
electron-unpacked: $(BUILD_DIR)/$(APP_NAME)-$$(VERSION)-$(TARGET_OS)-$(ARCH)/


#.PHONY: electron-inst
#electron-inst: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).msi


.PHONY: electron-run
electron-run: dev
	electron .


.PHONY: web
web: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-web.zip


.PHONY: run
run: electron-run


.PHONY: dist
dist: test-electron-dist
#dist: electron-dist


# NOTE: with the default sort order this gets the "latest" file, not sure
# 	how portable this is...
# XXX when ./dist is empty or non existent this will deploy the second arg...
# XXX HACK-ish...
# 	- deploy only when scrip both the script AND target are available
.PHONY: deploy
deploy: $(wildcard $(DIST_DIR)/$(APP_NAME)-*.zip) $(wildcard scripts/deploy.sh)
	@[ -e ./scripts/deploy.sh ] \
		&& [ -e $(DIST_DIR)/$(APP_NAME)-*.zip ] \
		&& bash ./scripts/deploy.sh "$(DIST_DIR)/$(APP_NAME)-*.zip" \
		|| echo "Deploy error: `[ -e ./scripts/deploy.sh ] && echo Distribution || echo Deploy script` not found."



#**********************************************************************
# Dependency checking...

require(%):
	@echo Checking for: $*
	@which $* > /dev/null


.PHONY: check
check: $(foreach dep,$(DEPENDENCIES),require($(dep)))



#**********************************************************************
# build rules...

NODE_MODULES_MINIMAL = $(foreach m,$(INCLUDE_NODE_MODULES),$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/$(m))
PACK_MINIMAL = $(BUILD_DIR)/$(APP_NAME)/ $(NODE_MODULES_MINIMAL)
PACK_FULL = $(BUILD_DIR)/$(APP_NAME)/ $(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)


# build date...
# NOTE: this depends on lots of stuff so as to be updated in case any of
# 	the dependencies are touched...
$(BUILD_INFO): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	$(MD) "$(@D)"
	@echo "Build info:"
	@echo "$(APP_NAME)" | tee $(BUILD_INFO)
	@echo "$(VERSION)" | tee -a $(BUILD_INFO)
	@echo "$(DATE)" | tee -a $(BUILD_INFO)
	@echo "$(COMMIT)" | tee -a $(BUILD_INFO)


%.css: %.less
	lessc $< > $@


# XXX might be a good idea to install directly to $(BUILD_DIR) so as not 
# 	to messup the current dir...
# XXX need to make this arch/os specific for cross compiling...
# XXX requirejs breaks here for some reason, breaking npm install and 
# 	the build...
#%/$(NODE_DIR): package.json
#	$(MD) "$@"
#	cp package*.json "$(@D)"
#	cd "$*" ; \
#		npm install ; \
#		electron-rebuild
#	@touch "$@"


#$(NODE_DIR):
$(NODE_DIR): package.json
	npm install
	electron-rebuild
	@touch "$@"


# build app dir...
$(BUILD_DIR)/$(APP_NAME)/: $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES) \
		$(wildcard $(FEATURES_DIR)/*.js) \
		$(wildcard $(LIB_DIR)/*.js) $(wildcard $(LIB_DIR)/widget/*.js) \
		$(wildcard $(DOMAIN_DIR)/*.js) \
		$(BUILD_INFO)
	$(MD) "$@"
	cp -r $(PROJECT_FILES) $(JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(BUILD_INFO) \
		"$(BUILD_DIR)/$(APP_NAME)"
	# cleanup vim swap files...
	# NOTE: we need to do this as we copy whole directories...
	cd "$@" ; \
		find . -name *.sw[po] -delete
	@touch "$@"


# add $(NODE_DIR) to app dir...
# NOTE: making $(NODE_DIR) a link/junction would be quite a bit faster 
# 	but it will also choke asar...
# XXX %/$(NODE_DIR): $(NODE_DIR) ???
$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR): $(NODE_DIR)
	$(MD) "$@"
	cp -r "$(NODE_DIR)" "$(@D)"
	@touch "$@"


# add ig-* $(NODE_DIR) modules...
$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/%: $(NODE_DIR)
	$(MD) "$(@D)"
	cp -r "$(NODE_DIR)/$*" "$(@D)"
	@touch "$@"


# targets for testing...
# NOTE: do not use these phony targets as dependencies...
# NOTE: these intersect, so one should remove the previos before making 
# 	a new app dir...
.PHONY: app-dir-full app-dir-minimal
app-dir-full: $(PACK_FULL)
app-dir-minimal: $(PACK_MINIMAL)



#----------------------------------------------------------------------
# Web...

$(DIST_DIR)/$(APP_NAME)-$(VERSION)-web.zip: $(PACK_MINIMAL)
	$(MD) "$(@D)"
	$(call zipfrom,$<,$@,*)



#----------------------------------------------------------------------
# Electron desktop build...

# helpers...
up = $(subst $(eval) ,/,$(foreach x,$(subst /, ,$1),..))
zipfrom = cd $1 ; \
	  zip -r "$(call up,$1)/$2" $3
zipdelfrom = cd $1 ; \
	     zip -d "$(call up,$1)/$2" $3



# pack app.asar (electron-specific)...
.PRECIOUS: $(BUILD_DIR)/app.asar
# XXX do we need to track changes to pack-full or to build it only if 
# 	app.asar is deleted?
#$(BUILD_DIR)/app.asar:
#	make check $(PACK_FULL)
$(BUILD_DIR)/app.asar: $(PACK_FULL)
	cd $(BUILD_DIR) ; \
		asar p "$(APP_NAME)" app.asar \
			--exclude-hidden \
			--unpack-dir node_modules/sharp


# get the electron binary (keep this cached)...
.PRECIOUS: $(TARGET_DIR)/$(ELECTRON_DIST)
$(TARGET_DIR)/$(ELECTRON_DIST):
	$(MD) "$(@D)"
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/$(ELECTRON_VERSION)/$(@F)" \
		-O "$@"


# build the app dir (electron-specific)...
# NOTE: the "/" here is significant -- it prevents conflicts with other 
# 	rules...
# XXX need to setup app icons...
.PRECIOUS: $(BUILD_DIR)/$(APP_NAME)-%/
$(BUILD_DIR)/$(APP_NAME)-%/: $(TARGET_DIR)/$(ELECTRON_DIST) \
		$(BUILD_DIR)/app.asar $(BUILD_INFO)
	unzip -u "$<" -d "$@" 
	cp -r $(BUILD_DIR)/app.asar* "$@/$(ASAR_PATH)/"
	cp -f "$(BUILD_INFO)" "$@/"
	# remove default_app.asar...
	$(RM) "$@/$(ASAR_PATH)/default_app.asar"
#	# setup app icon...
#	# XXX
	# rename app dir in zip...
	mv "$@/$(ELECTRON_BIN)$(EXT)" "$@/$(APP_BIN)$(EXT)"
	# fix permissions...
	chmod +x "$@/$(APP_BIN)$(EXT)" $(DLLs)
	@touch "$@"


# modify the archive in place (electron-specific)...
# XXX need to setup app icons...
$(BUILD_DIR)/$(APP_NAME)-%.in-place.zip: $(TARGET_DIR)/$(ELECTRON_DIST) \
		$(BUILD_DIR)/app.asar $(BUILD_INFO)
	cp "$<" "$@.tmp"
#	# setup app icon...
#	# XXX
	# remove default_app.asar...
	$(call zipdelfrom,"$(BUILD_DIR)",$@.tmp,"$(ASAR_PATH)/default_app.asar")
	# add app.asar...
	$(MD) "$(BUILD_DIR)/$(ASAR_PATH)"
	cp -r $(BUILD_DIR)/app.asar* "$(BUILD_DIR)/$(ASAR_PATH)/"
	$(call zipfrom,"$(BUILD_DIR)",$@.tmp,"$(ASAR_PATH)" "$(notdir $(BUILD_INFO))")
	# rename app in zip...
	zipnote "$@.tmp" \
		| sed 's/\(^@ $(ELECTRON_BIN)$(EXT)\)\(.*$$\)/\1\2\n@=$(APP_BIN)$(EXT)\2/' \
		| zipnote -w "$@.tmp"
	# cleanup...
	$(RM) $(BUILD_DIR)/$(firstword $(subst /, ,$(ASAR_PATH)))
	mv "$@.tmp" "$@"


# package the app dir (unpack - update - repack)...
$(BUILD_DIR)/$(APP_NAME)-%.repack.zip: $(BUILD_DIR)/$(APP_NAME)-%/
	$(MD) "$(@D)"
	$(call zipfrom,$<,$@,*)


# collect the built package to $(DIST_DIR)
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%.$(BUILD_MODE).zip
	$(MD) "$(@D)"
	cp "$<" "$@"



#----------------------------------------------------------------------
# Desktop installer (WiX)...

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
	$(MD) "$(@D)"



#----------------------------------------------------------------------
# deb/rpm package...
# XXX



#----------------------------------------------------------------------
# Mobile (cordova/PhoneGap)... 
# XXX




#**********************************************************************
#						       vim:set nowrap :
