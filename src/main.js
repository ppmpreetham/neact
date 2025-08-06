function createDom(fiber){
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
    return dom
}

function render(element, container) {
    nextUnitOfWork = {
        dom: container,
        props: {
            children: [element],
        }
    }
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

function performUnitOfWork(fiber) {
    // if fiber doesn't exist, create it
    if (!fiber.dom){
        fiber.dom = createDom(fiber); 
    }

    // if the fiber has a parent, append the current fiber's DOM node to the parent's DOM node
    if (fiber.parent) {
        fiber.parent.dom.appendChild(fiber.dom); // put me inside my parent
    }

    // all the children that this fiber should create
    const elements = fiber.props.children
    let index = 0
    let prevSibling = null

    while(index < elements.length) {
        const element = elements[index]
        const newFiber = {
            type: element.type,
            props: element.props,
            parent: fiber, // who's your daddy?
            dom: null // created the dom element or not
        }

        if (index === 0){
            // if this is their first child, set it as the first child of the fiber
            fiber.child = newFiber;
        } else {
            // if this is not their first child, set the previous sibling's sibling to the new fiber
            prevSibling.sibling = newFiber;
        }

        prevSibling = newFiber; // update the previous sibling to the current fiber
        index++; // move to the next child
    }
    if (fiber.child) {
        // if this fiber has a child, that’s the next unit of work
        return fiber.child
    }
    // if the fiber has no children, return the next sibling to continue the work
    nextFiber = nextFiber.parent
}

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