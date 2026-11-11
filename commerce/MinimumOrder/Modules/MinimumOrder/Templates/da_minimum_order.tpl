<div class="da-minimum-order {{#if reached}}is-reached{{/if}}">
    {{#if reached}}
        <p class="da-minimum-order__text">Your order meets the {{minimum}} minimum.</p>
    {{else}}
        <p class="da-minimum-order__text">Add <strong>{{remaining}}</strong> more to reach the {{minimum}} minimum order.</p>
    {{/if}}
    <div class="da-minimum-order__bar" role="progressbar" aria-valuenow="{{percent}}" aria-valuemin="0" aria-valuemax="100">
        <span class="da-minimum-order__fill" style="width: {{percent}}%"></span>
    </div>
</div>
