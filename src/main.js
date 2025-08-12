function createDom(fiber){
    // if the element is a text, create a text node else VDOM element of that type
    const dom = fiber.type === "TEXT_ELEMENT" ?
        document.createTextNode("") :
        document.createElement(fiber.type)

    // set properties on the DOM element except for "children" and events
    const isProperty = (key) => key !== "children" && !key.startsWith("on")
    Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
        dom[name] = fiber.props[name]
    })

    // set event listeners
    const isEvent = (key) => key.startsWith("on")
    Object.keys(fiber.props)
    .filter(isEvent)
    .forEach((name) => {
        const eventType = name.toLowerCase().substring(2)
        dom.addEventListener(eventType, fiber.props[name])
    })

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
    deletions = [] // deletions array for fibers to delete
    nextUnitOfWork = wipRoot; // start with the root fiber
}

//=======================================================//
//==Break down the rendering process into units of work==//
//=======================================================//

let nextUnitOfWork = null; // next task to be performed
let wipRoot = null; // work in progress root
let currentRoot = null; // current root for reconciliation
let deletions = null; // fibers to delete

function commitRoot() {
    deletions.forEach(commitWork); // commit deletions before everything
    commitWork(wipRoot.child); // commit the work starting from the first child
    currentRoot = wipRoot; // for reconciliation
    wipRoot = null; // reset the work in progress root
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }
    // get the parent fiber and its corresponding DOM node
    let domParentFiber = fiber.parent
    // find the closest DOM node
    while(!domParentFiber.dom) {
        // go up the tree until we find a DOM node
        domParentFiber = domParentFiber.parent
    }
    // get the DOM node for the parent fiber
    const domParent = domParentFiber.dom

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
    // check if fiber is a function component to update FC or the host
    const isFunctionComponent = (fiber) => fiber.type instanceof Function;
    if (isFunctionComponent(fiber)) {
        updateFunctionComponent(fiber); // if the fiber is a function component, update it
    } else {
        updateHostComponent(fiber); // if the fiber is a host component, update it
    }

    // all the children that this fiber should create
    
    if (fiber.child) {
        // if this fiber has a child, that's the next unit of work
        return fiber.child
    }
    
    // if the fiber has no children, return the next sibling to continue the work
    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}

let wipFiber = null; // work in progress fiber
let hookIndex = null; // current hook index

function updateFunctionComponent(fiber) {
    wipFiber = fiber; // set the work in progress fiber
    hookIndex = 0; // reset the hook index
    wipFiber.hooks = []; // initialize the hooks array for this fiber
    const children = [fiber.type(fiber.props)]; // call the function component with the props to get the children
    reconciliateChildren(fiber, children);
}

function useState(initial){
    const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]; // get the previous hook if it exists
    const hook = {
        state: oldHook ? oldHook.state : initial, // if the previous hook exists, use its state, else use the initial state
        queue: []
    }

    const actions = oldHook ? oldHook.queue : []; // get the actions from the previous hook if it exists
    actions.forEach(action => {
        hook.state = action(hook.state); // apply each action to the state
    })

    const setState = action => {
        hook.queue.push(action); // add the action to the queue
        wipRoot = {
            dom: currentRoot.dom, // keep the current root's DOM node
            props: currentRoot.props, // keep the current root's props
            alternate: currentRoot // keep the current root's alternate
        }
        deletions = []; // deletions array for re-render
        nextUnitOfWork = wipRoot;
    }
    wipFiber.hooks.push(hook); // add the hook to the work in progress fiber's hooks array
    hookIndex+= 1;
    return [hook.state, setState]
}

function updateHostComponent(fiber) {
    if(!fiber.dom){
        fiber.dom = createDom(fiber); // create the DOM node for the fiber
    }
    const children = fiber.props.children || []; // get the children from the props
    reconciliateChildren(fiber, children); // reconcile the children with the current fiber
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
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

    // Safety counter to prevent infinite loops
    let safetyCounter = 0;
    const MAX_ITERATIONS = 10000; 

    // Convert elements to array if needed
    const elementsArray = Array.isArray(elements) ? elements : 
                          elements ? [elements] : [];
    
    console.log("Starting reconciliation", {
        fiberType: wipFiber.type,
        elementsLength: elementsArray.length,
        hasOldFiber: !!oldFiber
    });

    while ((index < elementsArray.length || oldFiber !== null) && safetyCounter < MAX_ITERATIONS) {
        safetyCounter++;
        const element = elementsArray[index];
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

        if (oldFiber && !sameType) {
            // if we have an old fiber and types don't match, mark for deletion
            oldFiber.effectTag = "DELETION";
            deletions.push(oldFiber);
        }

        if (oldFiber) {
            // if we have an old fiber, we can reuse it
            oldFiber = oldFiber.sibling; // move to the next sibling
        }

        if (newFiber) {
            if (index === 0){
                // if this is their first child, set it as the first child of the fiber
                wipFiber.child = newFiber;
            } else if (prevSibling) {
                // if this is not their first child and we have a previous sibling, set the previous sibling's sibling to the new fiber
                prevSibling.sibling = newFiber;
            }
            prevSibling = newFiber; // update the previous sibling to the current fiber
        }
        
        index++;
    }
    
    // Log warning if we hit the safety limit
    if (safetyCounter >= MAX_ITERATIONS) {
        console.error("Infinite loop detected in reconciliation!");
        console.error("Fiber type:", wipFiber.type);
        console.error("Elements length:", elementsArray.length);
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
    useState,
}

function App(props){
    const [state, setState] = Neact.useState(1);
    return <h1 onClick={() => setState(prevState => prevState + 1)}>Hello, {props.name}. You clicked {state} times.</h1>}

/** @jsx Neact.createElement */

// we're using babel to transform JSX into Neact.createElement calls
const element = <App name="World" />

// container holds the root DOM element where to render the VDOM
window.onload = () => {
  const container = document.getElementById("app");
  Neact.render(element, container);
};