var seller_cache = {};
var observer;

function getAddress(dom)
{
	let info_block = dom.querySelector("#page-section-detail-seller-info");
	let headings = info_block.getElementsByClassName("a-text-bold");
	let business_name = headings[0].parentNode.querySelectorAll("span")[1].textContent;
	let business_addr = "";
	let business_country = "";
	
	// The business address is split into separate <span> elements for each line
	let addr_elems = info_block.querySelectorAll("div.indent-left > span");
	addr_elems.forEach(function(element, idx, array) {
		business_addr += element.textContent;
		if (idx != array.length - 1)
		{
			business_addr += "<br>";
		}
		
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
	let self_exists = document.querySelector("#wheres-that-from");
	let buy_it = document.querySelector("#desktop_buybox")
	let new_elem = document.createElement("div");
	let border_color = "orange";
	let brand_color = is_chinese_brand ? "red" : "green";
	
	if (address_info[2].toLowerCase().includes("china"))
	{
		border_color = "#b90000";
	}
	else if (address_info[2].toLowerCase().includes("usa") ||
			 address_info[2].toLowerCase().includes("us") ||
			 address_info[2].toLowerCase().includes("united states"))
	{
		border_color = "green";
	}

	// The hueristics didn't flag it as Chinese, but the seller is Chinese, so flag it
	if (!is_chinese_brand && address_info[2] == "China")
	{
		is_chinese_brand = true;
	}
	
	if (self_exists != null)
	{
		self_exists.remove();
	}

	new_elem.setAttribute("id", "wheres-that-from");
	new_elem.setAttribute("class", "celwidget");
	new_elem.innerHTML = `
<div class="celwidget">
	<div class="a-section a-spacing-mini">
		<div class="a-box a-spacing-none a-color-base-background a-text-left" style="border: 5px ${border_color} solid">
			<div class="a-box-inner a-padding-base">
				<div class="a-row a-spacing-small bbop-grid-container">
					<div class="a-column a-span12 a-checkbox bbop-grid-container-checkbox">
						<span class="bbop-content">
							<b>Brand Name:</b> ${brand}<br>
							<b>Chinese Brand?: </b>
							<span style="color:${brand_color};">${ is_chinese_brand ? 'likely' : 'unlikely' }</span><br><br>
							<b>Seller:</b> ${seller}<br>
							<b>Business Name:</b> ${address_info[0]}<br>
							<b>Business Country:</b> ${address_info[2]}<br>
							<b>Business Address:</b><span class="a-size-small">${address_info[1]}</span>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
`;

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

function apply_observers()
{
	// Watch for updates due to picking a different variation of the product or a different offer or seller
	const buybox_node = document.querySelector("#desktop_buybox");
	const accordion_node = document.querySelector("#newAccordionRow_0");
	const used_node = document.querySelector("#usedAccordionRow");

	const config = {
		attributes: true, 
		childList: true, 
		characterData: false
	};
	  
	const callback = mutations => {  
		checkSeller();
	}

	observer = new MutationObserver(callback);

	observer.observe(buybox_node, config);
	
	if (accordion_node != null)
		observer.observe(accordion_node, config);

	if (used_node != null)
		observer.observe(used_node, config);

	// Some items have multiple variants with multiple offers, including re-sale, which break it
	// https://www.amazon.com/SABRENT-Docking-Station-Function-DS-UFNC/dp/B00LS5NFQ2/144-7102972-2376831

	/*
	If there's ever more than one offer, we may need to trigger on all accordion rows
	// Accordion nodes for multiple sellers or offers
	let accordion_nodes = document.querySelectorAll("[id^='newAccordionRow_']");
	accordion_nodes.forEach((node) => {
		observer.observe(node, config);
	});
	*/
}

async function checkSeller()
{
	// Prevent more callbacks until we've processed this one
	// The DOM may have changed which means we'll need new observers
	observer.disconnect();
	
	// Check if we're on a product page
	if (document.querySelector("#dp") == null)
		return;

	// If there are multiple offers, they use an accordion layout instead
	let buy_row = document;
	let used = false;
	if (document.querySelector("#buyBoxAccordion") != null)
	{
		buy_row = document.querySelector("div.a-accordion-active");
		if (buy_row == null)
			return;
		
		if (buy_row.id == "usedAccordionRow")
		{
			used = true;
		}
	}

	let seller_href = null;
	let seller_info = [null, null];

	// Get the seller block
	if (used)
	{
		// Re-sale items have a different layout than normal items
		let seller_elements = buy_row.querySelectorAll("#merchant-info > a");
		if (seller_elements.length == 0)
			return;

		seller_href = seller_elements[0];
	}
	else
	{
		let seller_elements = buy_row.querySelectorAll("div[data-csa-c-slot-id='odf-feature-text-desktop-merchant-info']");
		if (seller_elements.length == 0)
			return;
		
		let seller_span = seller_elements[0].querySelector("span.offer-display-feature-text-message");
		seller_href = seller_span.querySelector("#sellerProfileTriggerId");
	}
	
	// See who is selling it or if it's Amazon

	
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
		if (seller_info[0] in seller_cache)
		{
			address_info = seller_cache[seller_info[0]];
		}
		else
		{
			try {
				address_info = await getData(seller_info[1]);
				seller_cache[seller_info[0]] = address_info;
			} catch (error) {
			  console.error(error.message);
			}
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
	
	// Watch for DOM changes
	apply_observers();
}

apply_observers();
checkSeller();
