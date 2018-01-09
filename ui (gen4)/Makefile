#**********************************************************************
#
# ImageGrid.Viewer Makefile...
#
#
# Make dependencies that need to be installed:
# 	- nodejs / npm 
# 		also nodejs-legacy seems to be required by some code...
# 	- npm i -g electron asar less
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
# 		- ...
# 	- cross-compiling support...
# 	- upstream clean build: git clone -> make dist
#
#
#
#**********************************************************************
# variables...

APP_NAME ?= ImageGrid.Viewer
#APP_BIN ?= $(APP_NAME)
APP_BIN ?= ig


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
	EXT = .exe
	DLLs = "$@/"*dll
	# NOTE: this is electron naming convention...
	TARGET_OS = win32

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
		TARGET_OS = linux
		ARCH ?= x64
	endif
	ifeq ($(shell uname -s),Darwin)
		TARGET_OS = darwin
	endif

	# XXX do we need this on a mac???
	# set arch...
	#ifeq ($(shell uname -p),x86_64)
	#	ARCH ?= x64
	#endif
	#ifneq ($(filter %86,$(shell uname -p)),)
	#	ARCH ?= ia32
	#endif
	ARCH ?= x64
endif


#----------------------------------------------------------------------
# Built-in make stuff...

# NOTE: some of the targets are directories so this will enable GNUMake's
# 	automatic cleanup to work.
# 	...not sure if this is the right way to go...
RM += -r



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

all: dev dist


.PHONY: all css dev clean cleanall dist \
	electron-dist-x64 electron-dist-ia32


css: $(CSS_FILES)


dev: $(NODE_DIR) css


clean:
	$(RM) $(BUILD_DIR)


cleanall: clean
	$(RM) $(DIST_DIR) $(TARGET_DIR)


electron-dist: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-$(ARCH).zip
electron-inst: $(DIST_DIR)/$(APP_NAME)-$(TARGET_OS)-$(ARCH).msi


dist: electron-dist



#**********************************************************************
# build rules...


# build date...
# XXX add build version...
$(BUILD_DATE): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	@mkdir -p "$(@D)"
	date "+%Y%m%d %H%M" > $(BUILD_DATE)


%.css: %.less
	lessc $< > $@


# XXX need to make this arch/os specific for cross compiling...
$(NODE_DIR):
	npm install


# build app dir...
# NOTE: making $(NODE_DIR) a link/junction would be quite a bit faster 
# 	but it will also choke asar...
$(BUILD_DIR)/$(APP_NAME): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES) \
		$(BUILD_DATE)
	@mkdir -p $@
	cp -r $(PROJECT_FILES) $(JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(BUILD_DATE) \
		"$(BUILD_DIR)/$(APP_NAME)"
	cp -r $(NODE_DIR) \
		"$(BUILD_DIR)/$(APP_NAME)"
	touch "$@"


# pack app.asar (electron-specific)...
# XXX need to do $(BUILD_DIR)/$(APP_NAME) iff app.asar does not exist...
$(BUILD_DIR)/app.asar: $(BUILD_DIR)/$(APP_NAME)
	cd $(BUILD_DIR) ; \
		asar p "$(APP_NAME)" app.asar


# get the electron binary (keep this cached)...
.PRECIOUS: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip
$(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip:
	@mkdir -p $(@D)
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/$(ELECTRON_VERSION)/$(@F)" \
		-O "$@"


# build the app dir (electron-specific)...
.PRECIOUS: $(BUILD_DIR)/$(APP_NAME)-%
$(BUILD_DIR)/$(APP_NAME)-%: $(TARGET_DIR)/electron-$(ELECTRON_VERSION)-%.zip \
		$(BUILD_DIR)/app.asar $(BUILD_DATE)
	unzip -u "$<" -d "$@" 
	cp "$(BUILD_DIR)/app.asar" "$@/resources/"
	cp -f "$(BUILD_DATE)" "$@/"
	$(RM) "$@/resources/default_app.asar"
	mv "$@/electron$(EXT)" "$@/$(APP_BIN)$(EXT)"
	chmod +x "$@/$(APP_BIN)$(EXT)" $(DLLs)
	touch "$@"


# package the app dir...
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%
	@mkdir -p "$(@D)"
	cd "$(BUILD_DIR)" ; \
		zip -r "../$@" "$(APP_NAME)-$*"


# XXX nwjs... (???)


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




#**********************************************************************
