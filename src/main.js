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
    wipRoot = {
        dom: container,
        props: {
            children: [element],
        },
        alternate: currentRoot, // reference the previous committed tree for reconciliation
    }
    nextUnitOfWork = wipRoot; // start with the root fiber
}

//=======================================================//
//==Break down the rendering process into units of work==//
//=======================================================//

let nextUnitOfWork = null; // next task to be performed
let wipRoot = null; // work in progress root
let currentRoot = null; // current root for reconciliation
    
function commitRoot() {
    commitWork(wipRoot.child); // commit the work starting from the first child
    currentRoot = wipRoot; // for reconciliation
    wipRoot = null; // reset the work in progress root
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }
    const domParent = fiber.parent.dom
    domParent.append(fiber.dom)
    
    if(fiber.effectTag === "PLACEMENT" && fiber.dom) {
        // if this fiber is a placement, we need to append it to the DOM
        domParent.appendChild(fiber.dom);
    }
    if(fiber.effectTag === "UPDATE" && fiber.dom) {
        // if this fiber is an update, we need to update the properties
        updateDom(fiber.dom, fiber.alternate.props, fiber.props);
    }
    
    commitWork(fiber.child); // commit the child first
    commitWork(fiber.sibling); // then commit the sibling
}

const isEvent = (key) => key.startsWith("on"); // check if a property is an event
const isProperty = key => key !== "children"; // check if a property is not "children"
const isGone = (prev, next) => key => !(key in next); // check if a property is gone in the new props
const isNew = (prev, next) => key => prev[key] !== next[key]; // check if a property is new in the new props

function updateDom(dom, prevProps, nextProps) {

    // remove old event listeners that are not in the new props
    Object.keys(prevProps)
        .filter(isEvent) // filter out event properties
        .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key)) // filter out properties that are not in the new props or have changed
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2); // get the event type by removing on (e.g. "onClick" -> "click")
            dom.removeEventListener(eventType, prevProps[name]); // remove the old event listener
        });

    // remove old properties that are not in the new props
    Object.keys(prevProps)
        .filter(isProperty) // filter out "children" property
        .filter(isGone(prevProps, nextProps)) // filter out properties that are not in the new props
        .forEach(name => {
            dom[name] = "";
        });
    
    // set new properties that are in the new props
    Object.keys(nextProps)
        .filter(isProperty) // filter out "children" property
        .filter(isNew(prevProps, nextProps)) // filter out properties that are not in the previous props
        .forEach(name => {
            dom[name] = nextProps[name]; // set the new property on the DOM element
        });

    // add new event listeners that are in the new props
    Object.keys(nextProps)
    .filter(isEvent) // filter out event properties
    .filter(isNew(prevProps, nextProps)) // filter out properties that are not in the previous props
    .forEach(name => {
        const eventType = name.toLowerCase().substring(2); // get the event type by removing on (e.g. "onClick" -> "click")
        dom.addEventListener(eventType, nextProps[name]); // add the new event listener
    });
}

// one small task at a time
function workLoop(deadline) {
    // stop if we run out of time
    let shouldYield = false;
    // keep doing tasks as long as we have them and time left
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork); // perform the next unit of work
        shouldYield = deadline.timeRemaining() < 1; // if we have less than 1ms left, we should stop and wait
    }

    if(!nextUnitOfWork && wipRoot) {
        // if we have no more work, we can commit the changes to the DOM
        commitRoot();
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
    reconciliateChildren(fiber, elements); // reconcile the children with the current fiber

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

function reconciliateChildren(wipFiber, elements) {
    let index = 0
    let prevSibling = null
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child; // get the previous fiber's first child

    while(index < elements.length || oldFiber !== null) {
        const element = elements[index]
        let newFiber = null;

        const sameType = oldFiber && element && oldFiber.type === element.type;

        if (sameType) {
            // if the type is the same, we can reuse the existing dom node
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom, // reuse the existing DOM node
                parent: wipFiber, // set the parent to the current fiber
                alternate: oldFiber, // reference the previous fiber for reconciliation
                effectTag: "UPDATE", // mark this fiber as needing an update
            }
        }
        
        if (element && !sameType) {
            // if the type is different, create a new fiber
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null, // we will create the DOM node later
                parent: wipFiber, // set the parent to the current fiber
                alternate: null, // no previous fiber to reference
                effectTag: "PLACEMENT", // mark this fiber as needing to be placed
            }
        }

        if (oldFiber) {
            // if we have an old fiber, we can reuse it
            oldFiber = oldFiber.sibling; // move to the next sibling
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