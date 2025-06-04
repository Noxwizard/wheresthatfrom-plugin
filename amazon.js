function getAddress(dom)
{
	let info_block = dom.querySelector("#page-section-detail-seller-info");
	let headings = info_block.getElementsByClassName("a-text-bold");
	let business_name = headings[0].parentNode.querySelectorAll("span")[1].textContent;
	let business_addr = "";
	let business_country = "";
	
	// The business address is split into separate <span> elements for each line
	let addr_elems = info_block.querySelectorAll("div.indent-left > span");
	addr_elems.forEach((element) => {
		business_addr += element.textContent + "<br>";
		
		if (element.textContent.toLowerCase().includes("cn") ||
			element.textContent.toLowerCase().includes("china"))
			{
				business_country = "China";
			}
	});
	
	// If no country was found, take the last line
	if (business_country.length == 0)
	{
		business_country = addr_elems[addr_elems.length - 1].textContent;
	}
	
	return [business_name, business_addr, business_country];
}

/**
	Adds a box above the "Add to cart" button
	
	@param seller: Name of seller
	@param address_info: [business name, business address, country]
	@param brand: Name of product brand
	@param is_chinese_brand: Is the brand likely Chinese?
 */
function insertBox(seller, address_info, brand, is_chinese_brand)
{
	let buy_it = document.querySelector("#addToCart_feature_div")
	let new_elem = document.createElement("div");
	let color = "orange";
	
	if (address_info[2].toLowerCase().includes("china"))
	{
		color = "red";
	}
	else if (address_info[2].toLowerCase().includes("usa") ||
			 address_info[2].toLowerCase().includes("us") ||
			 address_info[2].toLowerCase().includes("united states"))
	{
		color = "green";
	}

	// The hueristics didn't flag it as Chinese, but the seller is Chinese, so flag it
	if (!is_chinese_brand && address_info[2] == "China")
	{
		is_chinese_brand = true;
	}

	new_elem.setAttribute("style", "border-width: 5px;border-color: " + color + ";border-style: solid;padding: 5px;");
	new_elem.innerHTML = "<span><b>Seller:</b> " + seller + "<br><b>Brand Name:</b> " + brand + "<br><b>Chinese Brand?: </b>" + (is_chinese_brand ? "<span style='color:red;'>likely</span>" : "<span style='color:green;'>unlikely</span>") + "<br><b>Business Country:</b> " + address_info[2] + "<br><br><b>Business Name:</b> " + address_info[0] + "<br><b>Business Address:</b> " + address_info[1] + "</span>";
	
	buy_it.before(new_elem);
}

async function getData(url)
{
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

	const text = await response.text();
	let dom = new DOMParser().parseFromString(text, 'text/html');
	
	return getAddress(dom);
}

/**
 Just a simple hueristic to see if it's a Chinese company
 If it's 5-9 characters and all uppercase, it's Chinese
 */
function brand_heuristics(brand)
{
	if (brand.length >= 5 && brand.length <= 9)
	{
		for (const letter of brand)
		{
			if (!(letter.charCodeAt(0) >= 65 && letter.charCodeAt(0) <= 90))
			{
				// Contains a non-uppercase
				return false;
			}
		}
		return true;
	}
	
	return false;
}


async function checkSeller()
{
	// Check if we're on a product page
	if (document.querySelector("#dp") == null)
		return;
	

	// Get the seller block
	let seller_elements = document.querySelectorAll("div[data-csa-c-slot-id='odf-feature-text-desktop-merchant-info']");
	if (seller_elements.length == 0)
		return;

	// See who is selling it or if it's Amazon
	let seller_span = seller_elements[0].querySelector("span.offer-display-feature-text-message");
	let seller_href = seller_span.querySelector("#sellerProfileTriggerId");
	let seller_info = [null, null];
	
	if (seller_href != null)
	{
		// It's a real seller, get their name and profile link
		seller_info = [seller_href.text, seller_href.href];
	}
	else if (seller_span.innerText == "Amazon.com")
	{
		// It's Amazon selling it directly
		seller_info = ["Amazon.com", null];
	}


	//[business name, business address, country]
	let address_info = ["", "", ""];
	if (seller_info[1] != null)
	{
		try {
			address_info = await getData(seller_info[1]);
		} catch (error) {
		  console.error(error.message);
		}
	}
	else if (seller_info[0] == "Amazon.com")
	{
		address_info = ["Amazon.com", "", "United States"];
	}
	
	// Make a guess about the brand
	let brand = "";
	let byline = document.querySelector("#bylineInfo");
	let store_matches = byline.innerText.match(/Visit the (.*) Store/i);
	
	// Not everything has a store, might be "Brand: name" instead
	if (store_matches == null)
	{
		store_matches = byline.innerText.match(/Brand: (.*)/i);
	}
	
	if (store_matches != null && store_matches.length == 2)
		brand = store_matches[1];
	
	// Try to guess if the brand is Chinese
	let is_chinese_brand = brand_heuristics(brand);
	
	// Draw the box
	insertBox(seller_info[0], address_info, brand, is_chinese_brand);
}

checkSeller();