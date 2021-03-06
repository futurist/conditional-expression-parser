define(function(require, exports, module) {
  'use strict';
  
  var Utils = require('utils'),
      Condition = require('condition'),
      Operator = require('operator'),
      EvalTree = require('evalTree');
  
  function Expression(text) {
    var self = this;
    self.operators = [/*Operator*/];
    self.conditions = [/*Condition*/];
    
    // trim surrounding space and parenthesis pairs
    var textToParse = Utils.trimParenthesisPairs(text),
        topLevelParenthesis = Utils.findTopLevelParenthesis(textToParse),
        textChunks = [],
        lastPosition = 0;
    
    // Break the text into sub-expressions and top-level expressions
    // TODO: Identify when a ! precedes an Expression, and pass that into the constructor
    if(topLevelParenthesis.length === 0) {
      // There are no sub-expressions to extract.  Store the entire string
      textChunks.push(textToParse);
    } else {
      
      topLevelParenthesis.forEach(function(e) {
        // Store the text between previous chunk and start of this Expression
        textChunks.push(textToParse.substring(lastPosition, e.start));
        // Store the sub-expression
        textChunks.push(new Expression(textToParse.substring(e.start, e.end + 1)));
        // Advance the pointer
        lastPosition = e.end + 1;
      });
      
      // Store any trailing text
      if(lastPosition < textToParse.length - 1) {
        textChunks.push(textToParse.substring(lastPosition));
      }
      
    }
    
    var conditionChunks = [],
        matchAndOrXor = new RegExp(
          '(\\s|\\b)(?=' + Utils.tokensAndOrXor.join('|') + ')'
        , 'ig'),
        captureLeadingAnd = new RegExp(
          '^(' + Utils.tokensAnd.join('|') + ')'
        , 'ig'),
        captureLeadingOr = new RegExp(
          '^(' + Utils.tokensOr.join('|') + ')'
        , 'ig'),
        captureLeadingXor = new RegExp(
          '^(' + Utils.tokensXor.join('|') + ')'
        , 'ig'),
        leadingAndMatch, leadingOrMatch, leadingXorMatch, retVal, ignoredText;
    
    // TODO: Identify when the condition is preceded by a ! or has a negative comparison
    textChunks.forEach(function(textChunk) {
      // If this chunk is a sub-expression, just store it without parsing
      if(textChunk instanceof Expression) {
        self.conditions.push(textChunk);
      } else {
        // Remove all the text that should be ignored: the contents of function calls and strings
        // Otherwise the split() could match operators in those strings
        retVal = Utils.removeIgnoredText(textChunk);
        textChunk = retVal[0];
        ignoredText = retVal[1];
        
        conditionChunks = textChunk.split(matchAndOrXor);
        
        conditionChunks.forEach(function(condition) {
          // Determine if an AND operator or an OR operator was found.
          // If so, store which was found and then remove it.
          if((leadingAndMatch = condition.match(captureLeadingAnd)) !== null) {
            self.operators.push(new Operator.Operator(Operator.Operator.TYPE_AND));
            condition = condition.substring(leadingAndMatch[0].length);
          } else if((leadingOrMatch = condition.match(captureLeadingOr)) !== null) {
            self.operators.push(new Operator.Operator(Operator.Operator.TYPE_OR));
            condition = condition.substring(leadingOrMatch[0].length);
          } else if((leadingXorMatch = condition.match(captureLeadingXor)) !== null) {
            self.operators.push(new Operator.Operator(Operator.Operator.TYPE_XOR));
            condition = condition.substring(leadingXorMatch[0].length);
          }
          
          // Store anything that's not still empty.
          condition = condition.trim();
          if(condition !== '') {
            // Restore any text that was ignored above
            condition = Utils.restoreIgnoredText(condition, ignoredText);
            self.conditions.push(new Condition.Condition(condition));
          }
        });
        
      }
    });
    
    self.hasMixedOperators = Utils.hasMixedOperators(self.operators);
    
    self.truePaths = self.hasMixedOperators ? null : new EvalTree.EvalTree(self, true);
    self.falsePaths = self.hasMixedOperators ? null : new EvalTree.EvalTree(self, false);
    
    return this;
  }
  
  Expression.prototype.getEvalPaths = function(treeType) {
    return treeType ? this.truePaths : this.falsePaths;
  };
  
  Expression.prototype.hasMixedOperatorsDeep = function() {
    var self = this;
    return self.hasMixedOperators || self.conditions.some(function(c) {
      return (c instanceof Expression) && c.hasMixedOperatorsDeep();
    });
  };
  
  exports.Expression = Expression;

});