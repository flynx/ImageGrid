@echo off
rem this is just a stub...
rem

set ARCHIVE_ROOT=


set METADATA_DIR=metadata
set RAW_PREVIEW_DIR=hi-res (RAW)
set PROCESSED_PREVIEW_DIR=preview

set PROCESSED_PREVIEW_NAME=%%-:1d/%PROCESSED_PREVIEW_DIR%/%%f.jpg
set PREVIEW_NAME=%%-:1d/%RAW_PREVIEW_DIR%/%%f.jpg
set JSON_NAME=%%-:1d/%METADATA_DIR%/%%f.json


exiftool -if $jpgfromraw -b -jpgfromraw -w "%PREVIEW_NAME%" ^
	-execute -if $previewimage -b -previewimage -w "%PREVIEW_NAME%" ^
	-execute -FileModifyDate^<DateTimeOriginal -tagsfromfile @ ^
		-srcfile "%PREVIEW_NAME%" -overwrite_original ^
	-execute -j -w "%JSON_NAME%" ^
	-common_args --ext jpg -r "./%ARCHIVE_ROOT%" -progress


rem vim:set nowrap :
