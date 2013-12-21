/*
 * Copyright (c) 2013 Tomás Malbrán. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, window, brackets, Mustache */

define(function (require, exports, module) {
    "use strict";
	
    var AppInit            = brackets.getModule("utils/AppInit"),
        ExtensionUtils     = brackets.getModule("utils/ExtensionUtils"),
        StringUtils        = brackets.getModule("utils/StringUtils"),
        DocumentManager    = brackets.getModule("document/DocumentManager"),
        EditorManager      = brackets.getModule("editor/EditorManager"),
        LanguageManager    = brackets.getModule("language/LanguageManager"),
        ProjectManager     = brackets.getModule("project/ProjectManager"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        FontHolderTemplate = require("text!htmlContent/font-holder.html");
    
    
    
    /**
     * Update file name if necessary
     */
    function onFileNameChange(e, oldName, newName) {
        var $element    = $(".font-holder .font-path"),
            oldRelPath  = ProjectManager.makeProjectRelativeIfPossible(oldName),
            currentPath = $element.text();

        if (currentPath === oldRelPath) {
            var newRelName = ProjectManager.makeProjectRelativeIfPossible(newName);
            $element.text(newRelName).attr("title", newRelName);
        }
    }
    
    /** 
     * Sign off listeners when editor manager closes the font viewer
     */
    function onRemove() {
        $(DocumentManager).off("fileNameChange", onFileNameChange);
    }
    
    
    /** 
     * Perform decorations on the view that require loading the font in the browser
     * @param {!string} fullPath Path to the image file
     * @param {!jQueryObject} $editorHolder The DOM element to append the view to.
     */
    function render(fullPath, $editorHolder) {
        var file          = FileSystem.getFileForPath(fullPath),
            relPath       = ProjectManager.makeProjectRelativeIfPossible(fullPath),
            $customViewer = $(Mustache.render(FontHolderTemplate, {
                fullPath : fullPath,
                relPath  : relPath
            }));
        
        file.stat(function (err, stat) {
            if (!err && stat._size) {
                var dataString = StringUtils.prettyPrintBytes(stat._size, 2);
                $(".font-holder .font-data").text(dataString).attr("title", dataString);
                
                $customViewer.show();
            }
        });

        // place DOM node to hold image
        $editorHolder.append($customViewer);
        
        // make sure we always show the right file name
        $(DocumentManager).on("fileNameChange", onFileNameChange);
        
        return $customViewer;
    }
    
    
    
    LanguageManager.defineLanguage("font", {
        name: "Font",
        fileExtensions: ["eot", "ttf", "otf", "cff", "afm", "lwfn", "ffil", "fon", "pfm", "pfb", "woff", "std", "pro", "xsf"],
        isBinary: true
    });
    
    EditorManager.registerCustomViewer("font", {
        render   : render,
        onRemove : onRemove
    });
    
    AppInit.appReady(function () {
        ExtensionUtils.loadStyleSheet(module, "styles/main.css");
    });
});