function render(element, container) {
    // if the element is a text, create a text node else VDOM element of that type
    const dom = element.type === "TEXT_ELEMENT" ?
        document.createTextNode("") :
        document.createElement(element.type)

    // set properties on the DOM element except for "children"
    const isProperty = (key) => key !== "children"
    Object.keys(element.props)
    .filter(isProperty)
    .forEach((name) => {
        dom[name] = element.props[name]
    })

    // recursively render children
    element.props.children.forEach((child) => {render(child, dom)})
    container.appendChild(dom)
}

//=======================================================//
//==Break down the rendering process into units of work==//
//=======================================================//

// next task to be performed
let nextUnitOfWork = null;
// one small task at a time
function workLoop(deadline) {
    // stop if we run out of time
    let shouldYield = false;
    // keep doing tasks as long as we have them and time left
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork); // perform the next unit of work
        shouldYield = deadline.timeRemaining() < 1; // if we have less than 1ms left, we should stop and wait
    }
    requestIdleCallback(workLoop); // ask the browser to run workLoop again when it's free
}

// start the first loop when the browser is idle
requestIdleCallback(workLoop);

function createElement(type, props, ...children) {
    // if the type is a string, it is a DOM element, else it is a component
    return {
        type,
        props: {
            ...props,
            children: children.map((child) => 
                typeof child === "object" ? child : createTextElement(child)
            )
        }
    }
}

function createTextElement(text) {
  // type "TEXT_ELEMENT" is what we use to represent text nodes in the VDOM
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: []
        }
    }
}

const Neact = {
    createElement,
    render,
}

/** @jsx Neact.createElement */

const element = (
  // we're using babel to transform JSX into Neact.createElement calls
  <div id="div">
    <div>HELLO</div>
    <b />
  </div>
)

// container holds the root DOM element where to render the VDOM
window.onload = () => {
  const container = document.getElementById("app");
  Neact.render(element, container);
};