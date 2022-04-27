const LoaderUtils = {

    loadTextFile(file, onload) {
        var reader = new FileReader();
        reader.onload = (e) => {
            const text = e.currentTarget.result;
            if(onload) onload(text);
        };
        reader.readAsText(file);
    }

};

export { LoaderUtils };