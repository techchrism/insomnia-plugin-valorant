
function addPrefixToConsole(method)
{
    return (...args) =>
    {
        console[method]('[Valorant]', ...args);
    };
}

module.exports = {
    error: addPrefixToConsole('error'),
    warning: addPrefixToConsole('warning'),
    log: addPrefixToConsole('log'),
    info: addPrefixToConsole('log')
};
