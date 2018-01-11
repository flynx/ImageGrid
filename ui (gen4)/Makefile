#**********************************************************************
#
# ImageGrid.Viewer Makefile...
#
#
# Make dependencies that need to be installed:
# 	- nodejs / npm 
# 		also nodejs-legacy seems to be required by some code...
# 	- npm i -g electron electron-rebuild asar less
# 	- wget
# 	- zip / unzip / zipnote
# 		if zipnote fails this is likely due to a bug in v3.0, to
# 		fix this by either upgrading to a 3.1 or a patched version
# 		of the code...
# 		for more info and patch see: 
# 			https://goo.gl/csQmQo
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
# 	- might be a good idea to do a no-bin target -- exclude native...
# 	- add a cli-only build
# 	- installers:
# 		- msi
# 		- deb
# 		- ...
# 	- cross-compiling support...
# 	- upstream clean build: git clone -> make dist
# 	- nwjs???
#
#
# Variables to control the build:
# 	APP_NAME	- Application name
# 	APP_BIN		- App binary name (ignored for MacOS)
#
# 	ARCH		- target achitecture (ia32, x86)
# 	TARGET_OS	- target OS (win32, linux, darwin)
# 	ELECTRON_DOWNOAD_URL
# 			- URL to download electron pinary
#
# NOTE: cross compilation is at this time not supported, if you try it 
# 	and it works then 1) you got very lucky and 2) tell me about it =)
# 	...at least the node native packages (sharp) will likely either 
# 	fail or	win get compiled to the wrong arch and not be used and
# 	for the most part ImageGrid is cleaver about and will simply not
# 	load the depending features...
#
#
#**********************************************************************
# variables...

APP_NAME ?= ImageGrid.Viewer


# Electron stuff...
#
# NOTE: Linux does not let an app run if some of the libs it is dynamically 
# 	linked against are missing, this can happen if we try to run electron
# 	on a non-GUI box (i.e. no gtk)...
# 	...love the "statically" linked "dynamic" libs...
ELECTRON_VERSION_FALLBACK = v1.8.1
ELECTRON_VERSION := $(strip $(shell electron -v || echo $(ELECTRON_VERSION_FALLBACK)))
ELECTRON_DOWNOAD_URL ?= https://github.com/electron/electron/releases/download


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
BUILD_DIR = build
DIST_DIR = dist

NODE_DIR = node_modules
LIB_DIR = lib
EXT_LIB_DIR = ext-lib
CSS_DIR = css
CFG_DIR = cfg
DOMAIN_DIR = imagegrid
FEATURES_DIR = features
WORKERS_DIR = workers
IMAGES_DIR = images

BUILD_DATE = $(BUILD_DIR)/DATE
PROJECT_FILES = package.json
# get all .css build targets, in addition, get all the .less files and 
# replace .less with .css making them build targets...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard css/*.less))
HTML_FILES := $(wildcard *.html)
JS_FILES := $(wildcard *.js)



#**********************************************************************
# User targets...

all: check dev dist


css: $(CSS_FILES)


dev: check $(NODE_DIR) css


clean:
	$(RM) $(BUILD_DIR)


cleanall: clean
	$(RM) $(DIST_DIR) $(TARGET_DIR) $(NODE_DIR)


electron-dist: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-$(ARCH).zip
electron-inst: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-$(ARCH).msi

electron-dist-in-place: $(BUILD_DIR)/$(APP_NAME)-$(TARGET_OS)-$(ARCH).zip dist


dist: check electron-dist

dist-in-place: check electron-dist-in-place


.PHONY: all css dev clean cleanall dist dist-in-place \
	electron-dist-x64 electron-dist-ia32 electron-dist-in-place




#**********************************************************************
# Dependency checking...

require(%):
	@echo Checking for: $*
	@which $* > /dev/null


# XXX also add: heat, candle, light...
# XXX might be a good idea to split these to sections and check only what
# 	is needed...
# 	...like: base, electron, wix, ...
check: require(npm) require(wget) require(zip) require(unzip) \
	require(zipnote) \
	require(lessc) require(electron) require(electron-rebuild) \
	require(asar)


.PHONY: check require(%)



#**********************************************************************
# build rules...


# build date...
# XXX add build version...
$(BUILD_DATE): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	$(MD) "$(@D)"
	date "+%Y%m%d %H%M" > $(BUILD_DATE)


%.css: %.less
	lessc $< > $@


# XXX need to make this arch/os specific for cross compiling...
$(NODE_DIR):
	npm install
	electron-rebuild


# build app dir...
# NOTE: making $(NODE_DIR) a link/junction would be quite a bit faster 
# 	but it will also choke asar...
$(BUILD_DIR)/$(APP_NAME): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES) \
		$(BUILD_DATE)
	$(MD) "$@"
	cp -r $(PROJECT_FILES) $(JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(BUILD_DATE) \
		"$(BUILD_DIR)/$(APP_NAME)"
	cp -r $(NODE_DIR) \
		"$(BUILD_DIR)/$(APP_NAME)"
	touch "$@"



#----------------------------------------------------------------------
# Electron desktop build...

# pack app.asar (electron-specific)...
# XXX need to do $(BUILD_DIR)/$(APP_NAME) iff app.asar does not exist...
$(BUILD_DIR)/app.asar: $(BUILD_DIR)/$(APP_NAME)
	cd $(BUILD_DIR) ; \
		asar p "$(APP_NAME)" app.asar \
			--unpack-dir node_modules/sharp


# get the electron binary (keep this cached)...
.PRECIOUS: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip
$(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip:
	$(MD) "$(@D)"
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/$(ELECTRON_VERSION)/$(@F)" \
		-O "$@"


# build the app dir (electron-specific)...
# XXX BUILD_DIR is unguarded here...
.PRECIOUS: $(BUILD_DIR)/$(APP_NAME)-%
$(BUILD_DIR)/$(APP_NAME)-%: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip \
		$(BUILD_DIR)/app.asar $(BUILD_DATE)
	unzip -u "$<" -d "$@" 
	cp -r $(wildcard $(BUILD_DIR)/app.asar*) "$@/$(ASAR_PATH)/"
	cp -f "$(BUILD_DATE)" "$@/"
	# remove default_app.asar...
	$(RM) "$@/$(ASAR_PATH)/default_app.asar"
	# rename app dir in zip...
	mv "$@/$(ELECTRON_BIN)$(EXT)" "$@/$(APP_BIN)$(EXT)"
	# fix permissions...
	chmod +x "$@/$(APP_BIN)$(EXT)" $(DLLs)
	touch "$@"


# modify the archive in place (electron-specific)...
# XXX this (zip) depends on that DIST_DIR has only one level...
# XXX BUILD_DIR is unguarded here...
$(BUILD_DIR)/$(APP_NAME)-%.zip: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip \
		$(BUILD_DIR)/app.asar $(BUILD_DATE)
	cp "$<" "$@.tmp"
	# remove default_app.asar...
	cd "$(BUILD_DIR)" ; \
		zip -d "../$@.tmp" "$(ASAR_PATH)/default_app.asar"
	# add app.asar...
	$(MD) "$(BUILD_DIR)/$(ASAR_PATH)"
	cp -r $(wildcard $(BUILD_DIR)/app.asar*) "$(BUILD_DIR)/$(ASAR_PATH)/"
	cd "$(BUILD_DIR)" ; \
		zip -r "../$@.tmp" \
			"$(ASAR_PATH)" \
			"$(notdir $(BUILD_DATE))"
	# rename app dir in zip...
	zipnote "$@.tmp" \
		| sed 's/\(^@ $(ELECTRON_BIN)$(EXT)\)\(.*$$\)/\1\2\n@=$(APP_BIN)$(EXT)\2/' \
		| zipnote -w "$@.tmp"
	# cleanup...
	$(RM) $(BUILD_DIR)/$(firstword $(subst /, ,$(ASAR_PATH)))
	mv "$@.tmp" "$@"


# package the app dir (unpack - update - repack)...
# XXX this (zip) depends on that DIST_DIR and APP_NAME have only one level each...
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%
	$(MD) "$(@D)"
#	cd "$(BUILD_DIR)" ; \
#		zip -r "../$@" "$(APP_NAME)-$*"
	cd "$<" ; \
		zip -r "../../$@" *


# package the app dir (copy zip - update in-place)...
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%.zip
	$(MD) "$(@D)"
	mv "$<" "$@"



#----------------------------------------------------------------------
# Desktop installer...

# installer (WiX)...
# XXX add tools to path...

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



#----------------------------------------------------------------------
# Mobile XXX




#**********************************************************************
#						       vim:set nowrap :
