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
# 		fix this by either upgrading to 3.1 or a patched version
# 		of 3.0...
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
# Variables to control the build:
# 	APP_NAME	- Application name
# 	APP_BIN		- App binary name (ignored for MacOS)
#
# 	ARCH		- target achitecture (ia32, x86)
# 	TARGET_OS	- target OS (win32, linux, darwin)
# 	ELECTRON_DOWNOAD_URL
# 			- URL to download electron pinary
# 	BUILD_MODE	- can be "repack" or "in-place" (default)
#
# NOTE: when setting variables avoid using spaces and other characters 
# 	make can get fussy about...
# NOTE: to do a repack build call:
# 		(export BUILD_MODE=repack && make)
# NOTE: cross compilation is at this time not supported, if you try it 
# 	and it works then 1) you got very lucky and 2) tell me about it =)
# 	...at least the node native packages (sharp) will likely either 
# 	fail or	win get compiled to the wrong arch and not be used and
# 	for the most part ImageGrid is cleaver about and will simply not
# 	load the depending features...
#
#
#----------------------------------------------------------------------

# ToDo:
# 	- app icons...
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
#
#**********************************************************************
# variables...

APP_NAME ?= ImageGrid.Viewer


# XXX get actual version...
# XXX need to make getting the version usable from a bare checkout...
VERSION := $(strip $(shell node ./ig --version || echo 4.0.0a))
DATE := $(strip $(shell date "+%Y%m%d %H%M"))
COMMIT := $(strip $(shell git rev-parse HEAD))


# Electron stuff...
#
# NOTE: Linux does not let an app run if some of the libs it is dynamically 
# 	linked against are missing, this can happen if we try to run electron
# 	on a non-GUI box (i.e. no gtk)...
# 	...love the "statically" linked "dynamic" libs...
ELECTRON_VERSION_FALLBACK = v1.8.1
ELECTRON_VERSION := $(strip $(shell electron -v || echo $(ELECTRON_VERSION_FALLBACK)))
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
DEPENDENCIES = npm wget zip unzip zipnote \
	lessc electron electron-rebuild asar
# WiX dependencies...
#DEPENDENCIES += heat candle light



#**********************************************************************
# User targets...

all: check dev dist


css: $(CSS_FILES)


dev: $(NODE_DIR) css


clean:
	$(RM) $(BUILD_DIR)


cleanall: clean
	$(RM) $(DIST_DIR) $(TARGET_DIR) $(NODE_DIR)


electron-dist: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).zip

#electron-inst: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).msi


dist: electron-dist


web: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-web.zip


.PHONY: all css dev clean cleanall dist web dist-in-place \
	electron-dist electron-inst electron-dist-in-place



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
PACK_MINIMAL = $(BUILD_DIR)/$(APP_NAME) $(NODE_MODULES_MINIMAL)
PACK_FULL = $(BUILD_DIR)/$(APP_NAME) $(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)


# build date...
# XXX add build version...
$(BUILD_INFO): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	$(MD) "$(@D)"
	echo "$(APP_NAME)" > $(BUILD_INFO)
	echo "$(VERSION)" >> $(BUILD_INFO)
	echo "$(DATE)" >> $(BUILD_INFO)
	echo "$(COMMIT)" >> $(BUILD_INFO)


%.css: %.less
	lessc $< > $@


# XXX might be a good idea to install directly to $(BUILD_DIR) so as not 
# 	to messup the current dir...
# 		npm install --prefix ./build
# XXX need to make this arch/os specific for cross compiling...
$(NODE_DIR):
	npm install
	electron-rebuild


# build app dir...
$(BUILD_DIR)/$(APP_NAME): $(CSS_FILES) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES) \
		$(BUILD_INFO)
	$(MD) "$@"
	cp -r $(PROJECT_FILES) $(JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(BUILD_INFO) \
		"$(BUILD_DIR)/$(APP_NAME)"
	@touch "$@"


# add $(NODE_DIR) to app dir...
# NOTE: making $(NODE_DIR) a link/junction would be quite a bit faster 
# 	but it will also choke asar...
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
zipfrom = cd $1 ; zip -r "$(call up,$1)/$2" $3
zipdelfrom = cd $1 ; zip -d "$(call up,$1)/$2" $3



# pack app.asar (electron-specific)...
.PRECIOUS: $(BUILD_DIR)/app.asar
# XXX do we need to track changes to pack-full or to build it only if 
# 	app.asar is deleted?
#$(BUILD_DIR)/app.asar:
#	make check $(PACK_FULL)
$(BUILD_DIR)/app.asar: $(PACK_FULL)
	cd $(BUILD_DIR) ; \
		asar p "$(APP_NAME)" app.asar \
			--unpack-dir node_modules/sharp


# get the electron binary (keep this cached)...
.PRECIOUS: $(TARGET_DIR)/$(ELECTRON_DIST)
$(TARGET_DIR)/$(ELECTRON_DIST):
	$(MD) "$(@D)"
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/$(ELECTRON_VERSION)/$(@F)" \
		-O "$@"


# build the app dir (electron-specific)...
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
	$(MD) "$(@D)"



#----------------------------------------------------------------------
# Mobile XXX




#**********************************************************************
#						       vim:set nowrap :
