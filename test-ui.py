from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000/login')
    
    # Just to get past login if there's a dev bypass or wait to see what happens
    time.sleep(2)
    
    page.goto('http://localhost:3000/admin/knowledge')
    page.wait_for_load_state('networkidle', timeout=10000)
    
    page.screenshot(path='/Users/zyao0693/Desktop/www/ai-uni-tutor/knowledge-table.png', full_page=True)
    browser.close()
