require.config({
    paths: {
        vs: "./monaco-editor/min/vs"
    }
})
require(["vs/editor/editor.main"], initEditor)
function restrictEditArea (value) {
    const editable = (() => {
        const regexObjects = {};
        const labels = [];
        const generateRegexUsing = (label, flag, consumeSpace = false) => new RegExp((consumeSpace ? "\\^\\s*" : "") + "\\/\\*\\s*(" + label + ")(#([^#]+?))?\\s*(=\\s*([\\S\\s]+?))?\\s*\\*\\/" + (consumeSpace ? "\\s*\\$" + "\\" + "\\n" : ""), 'g')
        return {
            add: (name, label, regexReplacer, { consumeSpace } = {}, flag) => {
                regexObjects[name] = {
                    valueRegex: generateRegexUsing(label, flag),
                    regex: generateRegexUsing(label, flag, consumeSpace),
                    idIndex: 3,
                    fallbackContentIndex: 5,
                    regexReplacer: regexReplacer
                }
                labels.indexOf(label) === -1 && labels.push(label);
                return regexObjects[name];
            },
            getAll: () => regexObjects,
            getIdReplacerRegex: () => generateRegexUsing(labels.join('|'))
        }
    })();
    editable.add('singleLine', 'editableArea', '(.*?)')
    editable.add('multiLine', 'multiLineEditableArea', '((^.*?$\\n)*)', { consumeSpace: true }, 'gm')
    const generateRegexFromValue = (string, {
        singleLine,
        multiLine
    }, idReplacer) => {
        let valueToSet = string;
        let regexString = string;
        let map = {};
        let matchCount = 0;
        const regexFor = {
            brackets: /(\(|\)|\{|\}|\[|\])/g,
            newLine: /\n/g,
            blankSpace: /\s/g
        }
        valueToSet = valueToSet.replace(singleLine.valueRegex, "$" + singleLine.fallbackContentIndex)
        valueToSet = valueToSet.replace(multiLine.valueRegex, "$" + multiLine.fallbackContentIndex)
        regexString = regexString.replace(regexFor.brackets, '\\$1'); //! This order matters
        regexString = '^' + regexString.split(regexFor.newLine).join('$\\n^') + '$';
        regexString = regexString.replace(singleLine.regex, singleLine.regexReplacer)
        regexString = regexString.replace(multiLine.regex, multiLine.regexReplacer)
        string.replace(idReplacer, function (...matches) {
            map[matchCount++] = matches[3];
        })
        return {
            valueToSet: valueToSet,
            regexForValidation: new RegExp(regexString, 'm'),
            map: map
        }
    }
    return generateRegexFromValue(value, editable.getAll(), editable.getIdReplacerRegex())
}
const options = {
    fontSize: "20px",
    scrollBeyondLastLine: false
}
function initEditor () {
    const value = `function /*editableArea#funcName=fnName*/(/*editableArea#args=arg1,arg2*/){
  /*multiLineEditableArea#actualCode=//Enter your logic here
  // This Can also be a multi line string
  */
}`
    const jsSrcModel = monaco.editor.createModel(value, "javascript");
    const srcDiv = document.querySelector('.srcEditor');
    const jsSrcContainer = monaco.editor.create(srcDiv, options);
    
    jsSrcContainer.setModel(jsSrcModel);
}
function generateEditor () {
    const value = monaco.editor.getModels()[0].getValue();
    const { valueToSet, regexForValidation, map: idMap } = restrictEditArea(value)
    const destDiv = document.querySelector('.destEditor');
    const jsDestModel = monaco.editor.createModel(valueToSet, "javascript");
    const contents = Object.assign({}, options, {
        value: valueToSet,
        language: 'javascript'
    })
    const noChild = destDiv.childElementCount === 0;
    let jsDestContainer = window.destContainer;
    if (noChild) {
        jsDestContainer = monaco.editor.create(destDiv, contents);
        window.destContainer = jsDestContainer;
        // jsDestContainer.addAction({
        //     id: 'undo',
        //     label: 'Undo',
        //     run: () => {
        //         debugger
        //         jsDestContainer?.focus()
        //         if (!document.execCommand('undo')) {
        //             jsDestContainer.getModel()?.undo()
        //         }
        //     },
        // })
        // jsDestContainer.addAction({
        //     id: 'redo',
        //     label: 'Redo',
        //     run: () => {
        //         jsDestContainer?.focus()
        //         if (!document.execCommand('redo')) {
        //             jsDestContainer.getModel()?.redo()
        //         }
        //     },
        // })
        // jsDestContainer.addAction({
        //     id: 'editor.action.clipboardCutAction',
        //     label: 'Cut',
        //     run: () => {
        //         jsDestContainer?.focus()
        //         document.execCommand('cut')
        //     },
        // })
        // jsDestContainer.addAction({
        //     id: 'editor.action.clipboardCopyAction',
        //     label: 'Copy',
        //     run: () => {
        //         jsDestContainer?.focus()
        //         document.execCommand('copy')
        //     },
        // })
        // jsDestContainer.addAction({
        //     id: 'editor.action.clipboardPasteAction',
        //     label: 'Paste',
        //     run: () => {
        //         jsDestContainer?.focus()
        //         document.execCommand('paste')
        //     },
        // });
    }
    jsDestContainer.setModel(jsDestModel);
    jsDestModel.onDidChangeContentFast(({ isUndoing }) => {
        if (!isUndoing) {
            const doUndo = () => Promise.resolve().then(() => {
                jsDestModel.undo()
                // jsDestContainer.trigger('someIdString', 'undo')
            })
            const modelValue = jsDestModel.getValue();
            if (!regexForValidation.test(modelValue)) {
                doUndo();
            } else {
                const [completeMatch, ...otherMatches] = regexForValidation.exec(modelValue);
                if (completeMatch !== modelValue) {
                    doUndo();
                } else {
                    const valueMap = {};
                    for (let index in idMap) {
                        valueMap[idMap[index]] = otherMatches[index];
                    }
                    // console.clear();
                    console.table(valueMap);
                }
            }
        }
    })
}