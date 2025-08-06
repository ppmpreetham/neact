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

const element = Neact.createElement(
  // we're using babel to transform JSX into Neact.createElement calls
  <div id="div">
    <a>this is a link</a>
    <b />
  </div>
)

// container holds the root DOM element where to render the VDOM
const container = document.getElementById("root")
Neact.render(element, container)